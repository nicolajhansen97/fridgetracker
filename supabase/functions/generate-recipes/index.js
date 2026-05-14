// Edge function: generate-recipes
//
// Generates 3 recipes (or 1 refinement) for the user's ingredients, scaled
// to family size and translated to their locale.
//
// Provider chain (first success wins):
//   1. OpenRouter — by default uses an :online model so the AI searches the
//      web for real recipes. Pays per request.
//   2. Mistral    — fallback when OpenRouter fails (rate-limit, credit cap,
//      non-JSON response, etc.). No web search; recipes come from the model's
//      training memory. Reliable and cheap.
//
// Inputs (POST JSON):
//   mustUseItems     string[]  ingredients the user explicitly selected
//   otherFridgeItems string[]  everything else they have on hand
//   familySize       number    target servings
//   locale           string    "en" | "da" | "de" | "es" | "fr"
//   prompt           string?   free-text mood/style request
//   refineFrom       object?   an existing recipe to base a refinement on
//   refineInstruction string?  e.g. "make it vegetarian", "30 min max"
//
// Output:
//   { recipes: [{ title, description, totalMinutes, servings,
//                 ingredients: [{name, amount, unit, inFridge}], steps: [] }],
//     _provider: "openrouter" | "mistral",
//     _model: "..." }
//
// Required secret: at least one of OPENROUTER_API_KEY or MISTRAL_API_KEY
// Optional secrets:
//   OPENROUTER_MODEL   default "openai/gpt-4o-mini:online"
//   MISTRAL_MODEL      default "mistral-small-latest"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const rawOpenRouterModel =
  Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini:online";
// :online is what gives OpenRouter web-search. Bare models would hallucinate.
const OPENROUTER_MODEL = rawOpenRouterModel.includes(":online")
  ? rawOpenRouterModel
  : `${rawOpenRouterModel}:online`;

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") || "mistral-small-latest";

// Per-user daily rate limit. Comma-separated UUIDs in RATE_LIMIT_BYPASS_USERS
// skip the check entirely (use this for your own dev account).
const DAILY_LIMIT = parseInt(Deno.env.get("DAILY_LIMIT") || "3", 10);
const BYPASS_USERS = new Set(
  (Deno.env.get("RATE_LIMIT_BYPASS_USERS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// Service-role client for the rate-limit table. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are auto-injected into every edge function.
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

const LOCALE_NAMES = {
  en: "English",
  da: "Danish",
  de: "German",
  es: "Spanish",
  fr: "French",
};

function buildPrompt(req) {
  const language = LOCALE_NAMES[req.locale || "en"] || "English";
  const mustUse = (req.mustUseItems || []).join(", ") || "(none)";
  const otherItems = (req.otherFridgeItems || []).join(", ") || "(none)";
  const familySize = req.familySize || 4;
  const userPrompt = (req.prompt || "").trim();

  const system = `You are a practical cooking assistant. Suggest realistic, well-known recipes that match the user's ingredients and request. Recipes should be the kind people actually cook at home — clear ingredient lists, clear steps, achievable in a typical kitchen.

Always respond in ${language}. Translate titles, descriptions, ingredients, and steps to ${language}.

Output ONLY a single JSON object, no markdown fences, no commentary, matching this exact shape:
{
  "recipes": [
    {
      "title": "string",
      "description": "1-2 sentence pitch in ${language}",
      "totalMinutes": number,
      "servings": number,
      "ingredients": [
        { "name": "string in ${language}", "amount": number|null, "unit": "string"|null, "inFridge": boolean }
      ],
      "steps": ["short clear instruction in ${language}", "..."]
    }
  ]
}

Rules (in priority order):
1. PRIMARY: If the user described a specific dish, cuisine, or style in "What I'm in the mood for" (e.g. "burger", "Italian pasta", "Thai curry", "30-min vegetarian"), EVERY recipe must clearly be that dish / fit that style. With "burger", return 3 burger variants — not 3 unrelated dishes that happen to contain the ingredient. The mood is a hard constraint, not a hint.
2. SECONDARY: Use the user's MUST-use ingredients as the core of the chosen dish. E.g. mood="burger" + mustUse="ground beef" → 3 different burgers built around ground beef (classic, BBQ, blue-cheese, etc.). If the mood conflicts with a MUST-use ingredient (e.g. mood="vegetarian" + mustUse="chicken"), prioritize the mood and omit the conflicting ingredient.
3. If the user did NOT describe a mood, use the MUST-use ingredients as the primary driver and pick any sensible dishes.
4. CRITICAL — "Other ingredients I have" is reference data ONLY, used to compute the inFridge flag. It is NOT a permission slip to pull random fridge items into a recipe. Pick ingredients that genuinely belong in the dish you're making (e.g. a classic burger uses buns, beef, cheese, lettuce, tomato, onion — NOT pizza dough or pasta just because they happen to be in the fridge). If an "other" item is a natural ingredient for the dish, great, include it and mark inFridge:true. If it isn't, ignore it completely.
5. ingredient.inFridge MUST be true if the ingredient roughly matches any item from the user's listed ingredients (mustUse OR other), false otherwise. Match loosely (e.g. "chicken breast" in fridge counts for a recipe asking "chicken"; "ground beef" matches "hakket oksekød").
6. Set servings = ${familySize} and scale amounts accordingly.
7. Keep each step to 1-2 sentences.
8. Number of recipes: 3 for new requests, 1 for refinements.`;

  let user;
  if (req.refineFrom && req.refineInstruction) {
    user = `Refine this recipe based on the instruction. Return exactly ONE recipe inside the "recipes" array.

Original: ${JSON.stringify(req.refineFrom)}

Refinement request: "${req.refineInstruction}"

User's available ingredients: ${[
      ...(req.mustUseItems || []),
      ...(req.otherFridgeItems || []),
    ].join(", ") || "(none)"}`;
  } else {
    const wantBlock = userPrompt
      ? `\nWhat I'm in the mood for: "${userPrompt}" — this is the dish/style I want. Every recipe must match this.`
      : "";
    let rule;
    if (userPrompt && req.mustUseItems && req.mustUseItems.length) {
      rule = `Generate 3 distinct variations of "${userPrompt}" that use my MUST-use ingredients as the core. Do not produce unrelated dishes that merely contain those ingredients.`;
    } else if (userPrompt) {
      rule = `Generate 3 distinct variations of "${userPrompt}". Prefer recipes that use ingredients I already have if possible.`;
    } else {
      rule = `Generate 3 distinct recipes that all use my MUST-use ingredients.`;
    }
    user = `Ingredients I MUST use (expiring soon or specifically selected): ${mustUse}
Other things in my fridge (for inFridge matching only — do NOT add these to a recipe unless they naturally belong in the dish): ${otherItems}
Family size: ${familySize}${wantBlock}

${rule}`;
  }
  return { system, user };
}

function stripJsonFence(s) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}

function extractJson(content) {
  if (!content) return null;
  try {
    return JSON.parse(stripJsonFence(content));
  } catch {}
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// Try OpenRouter. Returns { parsed, model } on success, or { error } on
// failure. Failure modes: missing key, HTTP error, empty content, parse fail.
async function tryOpenRouter(system, user) {
  if (!OPENROUTER_API_KEY) return { error: "OPENROUTER_API_KEY not set" };
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
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        provider: { allow_fallbacks: true, sort: "throughput" },
      }),
    });
  } catch (e) {
    return { error: `OpenRouter fetch failed: ${String(e)}` };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { error: `OpenRouter HTTP ${response.status}: ${text}` };
  }
  let data;
  try {
    data = await response.json();
  } catch {
    return { error: "OpenRouter returned invalid JSON envelope" };
  }
  const content = data?.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  if (parsed == null) return { error: "OpenRouter returned non-JSON content" };
  return { parsed, model: OPENROUTER_MODEL };
}

// Try Mistral. Same contract as tryOpenRouter.
async function tryMistral(system, user) {
  if (!MISTRAL_API_KEY) return { error: "MISTRAL_API_KEY not set" };
  let response;
  try {
    response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        // 3 recipes in a non-English locale eat tokens fast (Danish words
        // are longer; UTF-8 tokenization isn't as efficient as English).
        // 4000 comfortably fits 3 full recipes; still ~$0.0012/request on
        // mistral-small-latest.
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });
  } catch (e) {
    return { error: `Mistral fetch failed: ${String(e)}` };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return { error: `Mistral HTTP ${response.status}: ${text}` };
  }
  let data;
  try {
    data = await response.json();
  } catch {
    return { error: "Mistral returned invalid JSON envelope" };
  }
  const content = data?.choices?.[0]?.message?.content;
  const finishReason = data?.choices?.[0]?.finish_reason;
  const parsed = extractJson(content);
  if (parsed == null) {
    const sample = (content || "").slice(0, 240).replace(/\s+/g, " ");
    return {
      error: `Mistral returned non-JSON content (finish=${finishReason || "?"}): ${sample}…`,
    };
  }
  return { parsed, model: MISTRAL_MODEL };
}

// Resolve the caller's auth.uid() from the incoming JWT. Returns null if
// the request is unauthenticated or the token is invalid — we treat that as
// "no rate-limit enforcement possible" and fail open (the gateway is what
// actually requires auth, this is best-effort).
async function getCallerUserId(req) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// Count this user's successful generations since UTC midnight today.
async function countTodayUsage(userId) {
  if (!supabaseAdmin) return 0;
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseAdmin
    .from("recipe_generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  if (error) {
    console.error("rate-limit count failed:", error);
    return 0;
  }
  return count || 0;
}

async function logUsage(userId) {
  if (!supabaseAdmin || !userId) return;
  const { error } = await supabaseAdmin
    .from("recipe_generation_log")
    .insert({ user_id: userId });
  if (error) console.error("rate-limit log insert failed:", error);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!OPENROUTER_API_KEY && !MISTRAL_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "No AI provider configured. Set OPENROUTER_API_KEY or MISTRAL_API_KEY.",
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  // Rate-limit check. Bypass list always passes; everyone else hits the cap.
  // Refinements still count — they spend tokens too. Pre-check before any
  // AI call so we don't pay for tokens just to reject.
  const callerId = await getCallerUserId(req);
  const isBypassed = callerId && BYPASS_USERS.has(callerId);
  if (callerId && !isBypassed) {
    const used = await countTodayUsage(callerId);
    if (used >= DAILY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: "DAILY_LIMIT_REACHED",
          detail: `Daily limit of ${DAILY_LIMIT} AI requests reached. Try again tomorrow.`,
          limit: DAILY_LIMIT,
          used,
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
  }

  const { system, user } = buildPrompt(body);

  // Provider chain: OpenRouter first, Mistral as backup.
  const attempts = [];
  let result = await tryOpenRouter(system, user);
  attempts.push({ provider: "openrouter", error: result.error });
  if (!result.parsed) {
    const fallback = await tryMistral(system, user);
    attempts.push({ provider: "mistral", error: fallback.error });
    if (fallback.parsed) {
      result = { ...fallback, provider: "mistral" };
    }
  } else {
    result.provider = "openrouter";
  }

  if (!result.parsed) {
    // Flatten attempt errors into one readable string so the client (whose
    // error extractor only looks at .error and .detail) actually shows them.
    const summary = attempts
      .filter((a) => a.error)
      .map((a) => `${a.provider}: ${a.error}`)
      .join(" | ");
    return new Response(
      JSON.stringify({
        error: "All AI providers failed",
        detail: summary || "no provider attempted",
        attempts,
      }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  // Only successful generations count against the user's quota.
  // Bypass users never get logged so their entries don't clutter the table.
  if (callerId && !isBypassed) {
    await logUsage(callerId);
  }

  return new Response(
    JSON.stringify({
      ...result.parsed,
      _provider: result.provider,
      _model: result.model,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
