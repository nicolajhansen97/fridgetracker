// Edge function: revenuecat-webhook
//
// Keeps Supabase in step with RevenueCat without waiting for the buyer to open
// the app.
//
// Why this exists: household Pro is shared through the `household_premium`
// table, and until now only the buyer's own client ever wrote it — with the
// expiry of whichever period was current at the time. A household subscriber
// who doesn't launch Freezely for a month therefore drops their whole family
// back to free while still being charged. Same story for `profiles.pro_*`: it
// only refreshed on app launch, so a renewed or lapsed subscription could sit
// stale indefinitely. Both are now written server-side the moment RevenueCat
// tells us something changed.
//
// SETUP
//   1. Deploy:
//        supabase functions deploy revenuecat-webhook --no-verify-jwt
//      --no-verify-jwt is required: RevenueCat sends its own header, not a
//      Supabase JWT. The shared secret below is what actually protects this.
//   2. Set the secret:
//        supabase secrets set REVENUECAT_WEBHOOK_SECRET="<long random string>"
//   3. RevenueCat -> Integrations -> Webhooks:
//        URL:            https://<project>.supabase.co/functions/v1/revenuecat-webhook
//        Authorization:  the same string as REVENUECAT_WEBHOOK_SECRET
//
// Requires ADD_SUBSCRIPTION_SYNC.sql (the pro_* columns) and
// CREATE_HOUSEHOLD_PREMIUM.sql.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const HOUSEHOLD_PRODUCT_ID = "freezely_pro_household_monthly";
const PRO_ENTITLEMENT = "pro";

const admin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Google Play reports `subscriptionId:basePlanId`; iOS reports the bare id.
const isHouseholdProduct = (id) =>
  typeof id === "string" &&
  (id === HOUSEHOLD_PRODUCT_ID || id.startsWith(HOUSEHOLD_PRODUCT_ID + ":"));

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// RevenueCat identifies a customer by whichever id the app was configured with,
// plus any aliases it has been merged with. Ours is the Supabase user id — but a
// customer created before the app identified properly also carries an
// `$RCAnonymousID:`, so scan every candidate for the one that is a UUID we know.
const resolveUserId = async (event) => {
  const candidates = [
    event && event.app_user_id,
    event && event.original_app_user_id,
    ...(Array.isArray(event && event.aliases) ? event.aliases : []),
  ].filter((v) => typeof v === "string" && UUID_RE.test(v));

  for (const id of candidates) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (data && data.id) return data.id;
  }

  // Last resort: we may have recorded this RevenueCat id during a client sync.
  const rcIds = [event && event.app_user_id, event && event.original_app_user_id]
    .filter(Boolean);
  for (const rc of rcIds) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("rc_app_user_id", rc)
      .maybeSingle();
    if (data && data.id) return data.id;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Refuse to run unauthenticated rather than accepting anything: this endpoint
  // grants Pro, so an open version of it is a free-subscription vending machine.
  if (!WEBHOOK_SECRET) {
    console.error("REVENUECAT_WEBHOOK_SECRET is not set");
    return json(500, { error: "not_configured" });
  }
  const auth = req.headers.get("Authorization") || "";
  if (auth !== WEBHOOK_SECRET) return json(401, { error: "unauthorized" });

  if (!admin) return json(500, { error: "no_service_client" });

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return json(400, { error: "bad_json" });
  }

  const event = body && body.event;
  if (!event || !event.type) return json(400, { error: "no_event" });

  // TEST fires from the dashboard's "Send test webhook" button.
  if (event.type === "TEST") return json(200, { ok: true, test: true });

  const entitlements =
    event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
  if (entitlements.length && !entitlements.includes(PRO_ENTITLEMENT)) {
    return json(200, { ok: true, ignored: "other_entitlement" });
  }

  const userId = await resolveUserId(event);
  if (!userId) {
    // 200, not an error: RevenueCat retries non-2xx, and no amount of retrying
    // makes an unmappable anonymous customer resolvable. Log it and move on.
    console.warn("[revenuecat] unmapped customer", {
      type: event.type,
      app_user_id: event.app_user_id,
    });
    return json(200, { ok: true, ignored: "unmapped_customer" });
  }

  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;

  // EXPIRATION means access is over now, whatever the stored expiry says.
  const ended =
    event.type === "EXPIRATION" || event.type === "SUBSCRIPTION_PAUSED";
  const proUntil = ended ? new Date().toISOString() : expiresAt;

  // RevenueCat does not send will_renew, so derive it. A cancellation keeps
  // access until the period ends — it just will not renew.
  let willRenew = null;
  if (ended || event.type === "CANCELLATION") {
    willRenew = false;
  } else if (
    ["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE"].includes(
      event.type
    )
  ) {
    willRenew = true;
  }

  const now = new Date().toISOString();

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      pro_until: proUntil,
      pro_product_id: event.product_id || null,
      pro_store: event.store || null,
      pro_period_type: event.period_type || null,
      pro_will_renew: willRenew,
      rc_app_user_id: event.app_user_id || null,
      pro_synced_at: now,
      updated_at: now,
    })
    .eq("id", userId);

  if (profileErr) {
    // 500 so RevenueCat retries — this one is worth retrying.
    console.error("[revenuecat] profile update failed:", profileErr.message);
    return json(500, { error: "profile_update_failed" });
  }

  // Household tier: push the expiry to every household this user OWNS, so the
  // rest of the family keeps Pro across renewals without the buyer opening the
  // app. Ownership only — being a member of someone else's household must never
  // hand that household a subscription.
  let householdsUpdated = 0;
  if (isHouseholdProduct(event.product_id)) {
    const { data: owned, error: memberErr } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId)
      .eq("role", "owner");

    if (memberErr) {
      console.error("[revenuecat] household lookup failed:", memberErr.message);
    } else {
      for (const row of owned || []) {
        const { error: hpErr } = await admin.from("household_premium").upsert(
          {
            household_id: row.household_id,
            premium_until: proUntil,
            updated_by: userId,
            updated_at: now,
          },
          { onConflict: "household_id" }
        );
        if (hpErr) {
          console.error("[revenuecat] household upsert failed:", hpErr.message);
        } else {
          householdsUpdated++;
        }
      }
    }
  }

  console.log("[revenuecat]", event.type, {
    userId: userId,
    proUntil: proUntil,
    product: event.product_id,
    householdsUpdated: householdsUpdated,
  });

  return json(200, { ok: true, type: event.type, householdsUpdated });
});
