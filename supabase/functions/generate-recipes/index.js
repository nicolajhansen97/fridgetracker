// Edge function: generate-recipes
//
// Generates 3 recipes (or 1 refinement) for the user's ingredients, scaled
// to family size and translated to their locale.
//
// Provider chain (first usable answer wins; providers without a key are
// skipped):
//   1. Gemini     — Google AI Studio free tier. The main provider.
//   2. Groq       — free tier, open-weight model. Backup when Gemini hits its
//      daily quota.
//   3. OpenRouter free router — no credits needed, ~50 requests/day.
//   4. OpenRouter — :online model that searches the web. Needs paid credits.
//   5. Mistral    — last resort.
// A provider is abandoned on rate-limit, credit cap, timeout, or an answer
// with no usable recipes.
//
// The model never decides on its own whether an ingredient is "in the fridge".
// It names which of the user's items covers an ingredient (fridgeItem), and we
// check that name against the list we sent before trusting it. It also flags
// pantry staples (salt, oil, flour…) so they aren't counted as missing or put
// on the shopping list.
//
// Inputs (POST JSON):
//   mustUseItems     string[]  ingredients the user explicitly selected
//   otherFridgeItems string[]  everything else they have on hand
//   familySize       number    target servings
//   locale           string    "en" | "da" | "de" | "es" | "fr"
//   prompt           string?   free-text mood/style request
//   excludeTitles    string[]? dishes the user has already been shown
//   refineFrom       object?   an existing recipe to base a refinement on
//   refineInstruction string?  e.g. "make it vegetarian", "30 min max"
//
// Output:
//   { recipes: [{ title, description, totalMinutes, servings,
//                 ingredients: [{name, amount, unit, fridgeItem, inFridge, pantry}],
//                 steps: [] }],
//     _provider: "gemini" | "groq" | "openrouter-free" | "openrouter" | "mistral",
//     _model: "..." }
//
// Required secret: at least one of GEMINI_API_KEY, GROQ_API_KEY,
// OPENROUTER_API_KEY or MISTRAL_API_KEY
// Optional secrets:
//   GEMINI_MODEL       default "gemini-flash-latest"
//   GROQ_MODEL         default "openai/gpt-oss-120b"
//   OPENROUTER_MODEL   default "openai/gpt-4o-mini:online"
//   MISTRAL_MODEL      default "mistral-small-latest"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Google's alias for its newest Flash model, so this doesn't break when a
// specific version is retired.
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-latest";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const GROQ_MODEL = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-120b";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const rawOpenRouterModel =
  Deno.env.get("OPENROUTER_MODEL") || "openai/gpt-4o-mini:online";
// :online is what gives OpenRouter web-search. Bare models would hallucinate.
const OPENROUTER_MODEL = rawOpenRouterModel.includes(":online")
  ? rawOpenRouterModel
  : `${rawOpenRouterModel}:online`;

const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
const MISTRAL_MODEL = Deno.env.get("MISTRAL_MODEL") || "mistral-small-latest";

// 3 full recipes in Danish/German JSON run to ~2500 tokens. The old 1000-token
// cap on OpenRouter cut every answer off mid-JSON, so every request silently
// fell through to Mistral after paying for the OpenRouter call.
const MAX_TOKENS = 4000;
// Edge functions are killed at 150s. A healthy provider answers well inside
// this; a hung one must still leave time for the rest of the chain.
const PROVIDER_TIMEOUT_MS = 35000;

// A big freezer can list hundreds of items. Past this the list only costs
// tokens; the model won't build dinner around item #300 anyway.
const MAX_OTHER_ITEMS = 150;

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

// Trim, dedupe (case-insensitively) and cap a list of item names from the client.
function cleanList(list, max) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = String(raw ?? "").trim().slice(0, 80);
    const key = s.toLowerCase();
    if (!s || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function readRequest(body) {
  const mustUse = cleanList(body.mustUseItems, 40);
  const mustKeys = new Set(mustUse.map((s) => s.toLowerCase()));
  const other = cleanList(body.otherFridgeItems, MAX_OTHER_ITEMS + 40)
    .filter((s) => !mustKeys.has(s.toLowerCase()))
    .slice(0, MAX_OTHER_ITEMS);
  const size = parseInt(body.familySize, 10);
  return {
    language: LOCALE_NAMES[body.locale] || "English",
    mustUse,
    other,
    familySize: Number.isFinite(size) ? Math.min(20, Math.max(1, size)) : 4,
    mood: String(body.prompt || "").trim().slice(0, 300),
    excludeTitles: cleanList(body.excludeTitles, 12),
    refineFrom: body.refineFrom && typeof body.refineFrom === "object" ? body.refineFrom : null,
    refineInstruction: String(body.refineInstruction || "").trim().slice(0, 300),
  };
}

function buildPrompt(r) {
  const { language, familySize } = r;

  const system = `You are an experienced home cook helping someone cook with what they already have in their freezer and fridge. Suggest real, well-known dishes — the kind found in a good cookbook — written so an ordinary home cook can follow them.

Always write in ${language}: titles, descriptions, ingredient names and steps. Write natural, everyday ${language} the way a native-speaking home cook would, with correct spelling and grammar. Never mix in English words or invent words.

Output ONLY one JSON object, no markdown, no commentary, in exactly this shape:
{
  "recipes": [
    {
      "title": "dish name",
      "description": "1-2 sentences: what the dish is and why it's good",
      "totalMinutes": integer,
      "ingredients": [
        { "name": "ingredient", "amount": number or null, "unit": "unit" or null, "fridgeItem": "item copied from MY INGREDIENTS" or null, "pantry": boolean }
      ],
      "steps": ["step", "..."]
    }
  ]
}

Choosing dishes, in priority order:
1. If I describe a dish, cuisine or style (e.g. "burger", "Thai", "quick vegetarian"), every recipe must be exactly that — with "burger", give burger variations, not unrelated dishes. If it conflicts with a must-use ingredient (e.g. "vegetarian" + chicken), follow my request and leave the ingredient out.
2. Build each recipe around my MUST-USE ingredients — every recipe uses at least one of them, and together the recipes cover as many of them as fit naturally.
3. Use what I already have. Prefer dishes where items from OTHER THINGS I HAVE belong naturally, so I need to buy as little as possible — ideally no more than 3-4 bought ingredients per recipe, not counting pantry staples. But never put an item into a dish it doesn't belong in just because I have it.
4. When I haven't asked for one specific dish, make the recipes clearly different from each other: different kinds of dish, cooking methods or cuisines.

Ingredients:
- fridgeItem: if one of MY INGREDIENTS (must-use or other) covers this ingredient, copy that item's name exactly as I wrote it. Otherwise null. Match on meaning, not spelling ("kyllingebryst" covers chicken; "hakket oksekød 8-12%" covers ground beef), but never claim a different food (cream is not milk, bacon is not ham).
- pantry: true ONLY for these basics: salt, pepper, cooking oil, sugar, flour, vinegar, water, stock cubes, and dried herbs and spices. Everything else is false — including eggs, garlic, butter, breadcrumbs, soy sauce, tomato paste, canned goods and fresh herbs — because I may need to buy them.
- List every ingredient the steps use, pantry staples included. If you say to serve it with something (rice, bread, potatoes), list that too. Amounts are for ${familySize} servings. Use metric units (g, kg, ml, dl, l) or tsp/tbsp; for things counted whole, put the count in amount and leave unit null (2 eggs → amount 2, unit null). amount is null only for "to taste".

Steps:
- 4-10 steps in cooking order, each 1-2 sentences.
- Be specific: heat level or oven temperature in °C, cooking times, and how to tell when it's done.
- MY INGREDIENTS all come from my freezer, so they are frozen. When frozen meat, poultry or fish has to thaw first, make thawing the first step (in the fridge overnight, or a quicker safe method), or cook it from frozen where that is normal and safe. Frozen vegetables and berries can usually go straight in.

totalMinutes is the hands-on plus cooking time, not counting thawing.`;

  const have = `MUST-USE ingredients (expiring soon or chosen by me): ${r.mustUse.join(", ") || "(none)"}
OTHER THINGS I HAVE: ${r.other.join(", ") || "(none)"}
Servings: ${familySize}`;

  let user;
  if (r.refineFrom && r.refineInstruction) {
    const original = r.refineFrom;
    // Send only the recipe content. Our own flags (inFridge, ids) would just
    // be noise the model might copy back.
    const recipe = {
      title: original.title,
      description: original.description,
      totalMinutes: original.totalMinutes,
      ingredients: (original.ingredients || []).map((i) => ({
        name: i?.name,
        amount: i?.amount ?? null,
        unit: i?.unit ?? null,
      })),
      steps: original.steps,
    };
    user = `${have}

Change this recipe as I ask below. Keep whatever my request doesn't affect. Return exactly ONE recipe in "recipes".

Recipe: ${JSON.stringify(recipe)}

My request: "${r.refineInstruction}"`;
  } else {
    const lines = [have];
    if (r.mood) lines.push(`What I'm in the mood for: "${r.mood}"`);
    if (r.excludeTitles.length) {
      lines.push(`I've already seen these, so suggest different dishes: ${r.excludeTitles.join("; ")}`);
    }
    lines.push("", "Return exactly 3 recipes.");
    user = lines.join("\n");
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

// Web-search models like to cite their sources as markdown links, even inside
// JSON strings. Those are citations, not part of the recipe — drop them.
function cleanText(v, max = 600) {
  if (v == null) return "";
  return String(v)
    .replace(/\s*\(?\[[^\]]*\]\(https?:[^)]*\)\)?/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const UNICODE_FRACTIONS = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

// Models sometimes send amounts as "1/2", "1 ½" or "200" instead of numbers.
function parseAmount(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  let s = String(v).trim().replace(",", ".");
  let total = 0;
  for (const [ch, val] of Object.entries(UNICODE_FRACTIONS)) {
    if (s.includes(ch)) {
      total += val;
      s = s.replace(ch, " ").trim();
    }
  }
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)/);
  const frac = s.match(/^(\d+)\/(\d+)/);
  if (mixed) total += Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  else if (frac) total += Number(frac[1]) / Number(frac[2]);
  else if (s) {
    const n = parseFloat(s);
    if (Number.isFinite(n)) total += n;
  }
  return total > 0 && Number.isFinite(total) ? Math.round(total * 1000) / 1000 : null;
}

// Resolve which of the user's items covers an ingredient. Trust the model's
// fridgeItem only when it names something we actually sent; otherwise fall
// back to a conservative name match so a sloppy answer can't invent stock.
function resolveFridgeItem(ing, haveByKey) {
  const claimed = matchKey(cleanText(ing.fridgeItem, 80));
  if (claimed && haveByKey.has(claimed)) return haveByKey.get(claimed);
  // The model explicitly said "none of yours". Believe it: a name match would
  // get compounds wrong ("peber" is not "peberfrugt").
  if (!claimed && "fridgeItem" in ing) return null;
  // Otherwise the model either skipped the field or misquoted an item name;
  // match on the best text we have.
  const c = claimed || matchKey(cleanText(ing.name, 80));
  if (!c) return null;
  for (const [key, original] of haveByKey) {
    if (key === c) return original;
    // Substring match only for reasonably long names, so "is" (Danish for
    // ice cream) doesn't match half the ingredient list.
    if (key.length >= 4 && c.length >= 4 && (c.includes(key) || key.includes(c))) {
      return original;
    }
  }
  return null;
}

// Compare names ignoring case, Unicode form and dash style — models like to
// write "8‑12%" with a non-breaking hyphen where the user typed "8-12%".
function matchKey(s) {
  return String(s || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRecipe(raw, familySize, haveByKey) {
  if (!raw || typeof raw !== "object") return null;
  const title = cleanText(raw.title, 120);
  if (!title) return null;

  const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .map((ing) => {
      if (typeof ing === "string") ing = { name: ing };
      if (!ing || typeof ing !== "object") return null;
      const name = cleanText(ing.name, 120);
      if (!name) return null;
      const fridgeItem = resolveFridgeItem(ing, haveByKey);
      return {
        name,
        amount: parseAmount(ing.amount),
        unit: cleanText(ing.unit, 20) || null,
        fridgeItem,
        inFridge: !!fridgeItem,
        // Something the user has is never "just a staple" — show it as theirs.
        pantry: !fridgeItem && (ing.pantry === true || ing.pantry === "true"),
      };
    })
    .filter(Boolean);

  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s) => (s && typeof s === "object" ? s.text || s.instruction || s.step : s))
    .map((s) => cleanText(s, 600).replace(/^(?:step\s*)?\d+[.):]\s*/i, ""))
    .filter(Boolean);

  if (ingredients.length === 0 || steps.length === 0) return null;

  const minutes = Math.round(Number(raw.totalMinutes));
  return {
    title,
    description: cleanText(raw.description, 400),
    totalMinutes: Number.isFinite(minutes) && minutes > 0 ? minutes : null,
    servings: familySize,
    ingredients,
    steps,
  };
}

function normalizeRecipes(parsed, r) {
  const list = Array.isArray(parsed) ? parsed : parsed?.recipes;
  if (!Array.isArray(list)) return [];
  const haveByKey = new Map(
    [...r.mustUse, ...r.other].map((name) => [matchKey(name), name])
  );
  const expected = r.refineFrom && r.refineInstruction ? 1 : 3;
  return list
    .map((raw) => normalizeRecipe(raw, r.familySize, haveByKey))
    .filter(Boolean)
    .slice(0, expected);
}

// One OpenAI-compatible chat call. Returns { content } or { error }.
async function callChat(
  { url, apiKey, model, headers, extraBody, timeoutMs = PROVIDER_TIMEOUT_MS },
  system,
  user
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        ...extraBody,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { error: `HTTP ${response.status}: ${text.slice(0, 300)}` };
    }
    // Read the body inside the try: a timeout can fire while it's still
    // arriving, and that should be reported as a timeout.
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { error: `invalid JSON envelope: ${text.slice(0, 200)}` };
    }
    // OpenRouter can answer 200 with an error object (e.g. upstream failure).
    if (data?.error) return { error: `upstream error: ${JSON.stringify(data.error).slice(0, 300)}` };
    const choice = data?.choices?.[0];
    return { content: choice?.message?.content, finishReason: choice?.finish_reason };
  } catch (e) {
    return {
      error: e?.name === "AbortError" ? `timed out after ${timeoutMs / 1000}s` : `fetch failed: ${String(e)}`,
    };
  } finally {
    clearTimeout(timer);
  }
}

const PROVIDERS = [
  {
    name: "gemini",
    apiKey: GEMINI_API_KEY,
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: GEMINI_MODEL,
    // Flash "thinks" before answering and that comes out of max_tokens, so
    // give it room on top of the recipes themselves.
    extraBody: { max_tokens: 12000 },
  },
  {
    name: "groq",
    apiKey: GROQ_API_KEY,
    url: "https://api.groq.com/openai/v1/chat/completions",
    model: GROQ_MODEL,
    // gpt-oss reasons before answering; keep it short so the free tier's
    // per-minute token budget goes on the recipes.
    extraBody: { reasoning_effort: "low" },
  },
  {
    // OpenRouter's free-model router: costs nothing and works on an account
    // that has never bought credits, but is capped at ~50 requests/day and
    // picks whichever free model is available (some of them reason first).
    name: "openrouter-free",
    apiKey: OPENROUTER_API_KEY,
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openrouter/free",
    headers: { "HTTP-Referer": "https://freezely.app", "X-Title": "Freezely" },
    extraBody: { max_tokens: 8000 },
    // Free models run on shared capacity and are often slow (over 70s in
    // testing). Give it a fair chance without making people wait forever.
    timeoutMs: 50000,
  },
  {
    name: "openrouter",
    apiKey: OPENROUTER_API_KEY,
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: OPENROUTER_MODEL,
    headers: { "HTTP-Referer": "https://freezely.app", "X-Title": "Freezely" },
    extraBody: { provider: { allow_fallbacks: true, sort: "throughput" } },
  },
  {
    name: "mistral",
    apiKey: MISTRAL_API_KEY,
    url: "https://api.mistral.ai/v1/chat/completions",
    model: MISTRAL_MODEL,
  },
];

// Try each configured provider in order until one returns usable recipes.
async function generate(r) {
  const { system, user } = buildPrompt(r);
  const attempts = [];
  for (const p of PROVIDERS) {
    if (!p.apiKey) continue;
    const res = await callChat(p, system, user);
    if (res.error) {
      attempts.push({ provider: p.name, error: res.error });
      continue;
    }
    const parsed = extractJson(res.content);
    const recipes = parsed == null ? [] : normalizeRecipes(parsed, r);
    if (recipes.length > 0) {
      return { recipes, provider: p.name, model: p.model, attempts };
    }
    const sample = (res.content || "").slice(0, 240).replace(/\s+/g, " ");
    attempts.push({
      provider: p.name,
      error: `${parsed == null ? "non-JSON content" : "no usable recipes"} (finish=${res.finishReason || "?"}): ${sample}…`,
    });
  }
  return { recipes: [], attempts };
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

  if (!PROVIDERS.some((p) => p.apiKey)) {
    return new Response(
      JSON.stringify({
        error: "No AI provider configured. Set GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY or MISTRAL_API_KEY.",
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

  const request = readRequest(body);
  const result = await generate(request);

  if (result.recipes.length === 0) {
    // Flatten attempt errors into one readable string for the logs. The app
    // shows its own friendly message and only logs this.
    const summary = result.attempts
      .map((a) => `${a.provider}: ${a.error}`)
      .join(" | ");
    console.error("generate-recipes failed:", summary);
    return new Response(
      JSON.stringify({
        error: "All AI providers failed",
        detail: summary || "no provider attempted",
        attempts: result.attempts,
      }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
  if (result.attempts.length) {
    console.warn("generate-recipes fell back:", JSON.stringify(result.attempts));
  }

  // Only successful generations count against the user's quota.
  // Bypass users never get logged so their entries don't clutter the table.
  if (callerId && !isBypassed) {
    await logUsage(callerId);
  }

  return new Response(
    JSON.stringify({
      recipes: result.recipes,
      _provider: result.provider,
      _model: result.model,
    }),
    { headers: { "Content-Type": "application/json", ...corsHeaders } }
  );
});
