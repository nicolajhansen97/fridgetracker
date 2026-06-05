// Edge function: analyze-product
//
// Identifies a single grocery/food product from a photo of its packaging
// (for products that aren't in any barcode database — e.g. local Danish
// store brands). Uses an OpenRouter vision model and returns the product
// name plus package size when legible.
//
// Input (POST JSON):
//   imageBase64  string   JPEG image as raw base64 (no data: prefix)
//   locale       string   "en" | "da" | "de" | "es" | "fr"
//
// Output:
//   { name: string, quantity: number|null, unit: string|null }
//   name is "" when no product could be identified.
//
// Required secret: OPENROUTER_API_KEY (same one generate-recipes uses).
// Optional secrets:
//   VISION_MODEL              default "openai/gpt-4o-mini" (must support images)
//   DAILY_LIMIT               shared daily AI cap (default 3)
//   RATE_LIMIT_BYPASS_USERS   comma-separated UUIDs that skip the cap

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const VISION_MODEL = Deno.env.get("VISION_MODEL") || "openai/gpt-4o-mini";

const DAILY_LIMIT = parseInt(Deno.env.get("DAILY_LIMIT") || "3", 10);
const BYPASS_USERS = new Set(
  (Deno.env.get("RATE_LIMIT_BYPASS_USERS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOCALE_NAMES = { en: "English", da: "Danish", de: "German", es: "Spanish", fr: "French" };
const ALLOWED_UNITS = ["pcs", "kg", "g", "lbs", "oz", "portions"];

function stripJsonFence(s) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}
function extractJson(content) {
  if (!content) return null;
  try { return JSON.parse(stripJsonFence(content)); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

async function getCallerUserId(req) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}
async function countTodayUsage(userId) {
  if (!supabaseAdmin) return 0;
  const start = new Date(); start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseAdmin
    .from("recipe_generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  if (error) { console.error("rate-limit count failed:", error); return 0; }
  return count || 0;
}
async function logUsage(userId) {
  if (!supabaseAdmin || !userId) return;
  const { error } = await supabaseAdmin.from("recipe_generation_log").insert({ user_id: userId });
  if (error) console.error("rate-limit log insert failed:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!OPENROUTER_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not set" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const imageBase64 = body?.imageBase64;
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return new Response(JSON.stringify({ error: "imageBase64 required" }), {
      status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const language = LOCALE_NAMES[body?.locale] || "English";

  // Shared daily AI cap (same table/limit as recipe generation).
  const callerId = await getCallerUserId(req);
  const isBypassed = callerId && BYPASS_USERS.has(callerId);
  if (callerId && !isBypassed) {
    const used = await countTodayUsage(callerId);
    if (used >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({ error: "DAILY_LIMIT_REACHED", limit: DAILY_LIMIT, used }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  const system = `You identify a single grocery or food product from a photo of its packaging. Respond in ${language}.
Output ONLY a JSON object, no markdown fences, matching exactly:
{ "found": boolean, "name": "string", "quantity": number|null, "unit": "string"|null }
- name: concise product name (brand + product) in ${language}, e.g. "Arla skummetmælk". No extra words.
- quantity + unit: the net package size only if clearly printed. unit MUST be one of ${ALLOWED_UNITS.join(", ")}. Convert nothing; if the size is in ml/l/cl or unclear, set quantity and unit to null.
- If you cannot identify a real product, set "found": false and "name": "".`;

  const dataUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://freezely.app",
        "X-Title": "Freezely",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this product." },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `OpenRouter fetch failed: ${String(e)}` }), {
      status: 502, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return new Response(JSON.stringify({ error: `OpenRouter HTTP ${response.status}`, detail: text }), {
      status: 502, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  let data;
  try { data = await response.json(); } catch {
    return new Response(JSON.stringify({ error: "OpenRouter invalid JSON envelope" }), {
      status: 502, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const parsed = extractJson(data?.choices?.[0]?.message?.content);
  const name = parsed?.found && parsed?.name ? String(parsed.name).trim() : "";
  const unit = ALLOWED_UNITS.includes(parsed?.unit) ? parsed.unit : null;
  const quantity = unit && Number.isFinite(parsed?.quantity) ? Math.round(parsed.quantity) : null;

  if (callerId && !isBypassed) await logUsage(callerId);

  return new Response(
    JSON.stringify({ name, quantity, unit, _model: VISION_MODEL }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
