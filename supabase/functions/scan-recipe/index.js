// Edge function: scan-recipe
//
// Reads a recipe from one to three photos (a cookbook page, a printout, a
// handwritten card) and returns it in the same clean shape the app uses for
// AI recipes: title, servings, time, ingredients with amounts and units, and
// numbered steps. A Freezely Pro feature (gated in the app).
//
// Provider: Groq free tier, vision model qwen/qwen3.8-27b (Groq retired the
// Llama 4 vision models in 2026; this is the one that takes images, max 3 per
// request, and supports JSON mode). Same GROQ_API_KEY as generate-recipes.
//
// The recipe is transcribed in the language it is written in; it is not
// translated. Ingredient matching against the user's inventory is done by
// the model (it knows "hakket oksekød" is the user's "Hakket kød 8-12%"), but
// only names we actually sent are trusted. The app re-checks against the live
// inventory each time the recipe is opened.
//
// Input (POST JSON):
//   images      string[]  1-3 JPEGs as raw base64 (no data: prefix), in page order
//   locale      string    "en" | "da" | "de" | "es" | "fr" (for the description)
//   inventory   string[]  names of the user's current items (optional)
//
// Output:
//   { found: true, recipe: { title, description, servings, totalMinutes,
//       ingredients: [{ name, amount, unit, group, note, pantry, fridgeItem, inFridge }],
//       steps: [string] }, _model }
//   { found: false }  when the photo isn't a readable recipe
//   429 { error: "DAILY_LIMIT_REACHED", limit, used }
//
// Secrets:
//   GROQ_API_KEY            required
//   GROQ_VISION_MODEL       default "qwen/qwen3.8-27b"
//   SCAN_DAILY_LIMIT        scans per user per UTC day (default 10)
//   RATE_LIMIT_BYPASS_USERS comma-separated UUIDs that skip the cap

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const VISION_MODEL = Deno.env.get("GROQ_VISION_MODEL") || "qwen/qwen3.8-27b";
const SCAN_DAILY_LIMIT = parseInt(Deno.env.get("SCAN_DAILY_LIMIT") || "10", 10);
const BYPASS_USERS = new Set(
  (Deno.env.get("RATE_LIMIT_BYPASS_USERS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);
const MAX_IMAGES = 3;
const TIMEOUT_MS = 55_000;

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

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const LOCALE_NAMES = { en: "English", da: "Danish", de: "German", es: "Spanish", fr: "French" };

// ---------- parsing helpers (same rules as generate-recipes) ----------

function stripJsonFence(s) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
}
function extractJson(content) {
  if (!content) return null;
  // Qwen can think out loud first; drop a <think> block if one slips through.
  const text = String(content).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  try { return JSON.parse(stripJsonFence(text)); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

function cleanText(v, max = 600) {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim().slice(0, max);
}

const UNICODE_FRACTIONS = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

// Cookbooks write "1/2", "1 ½", "2-3" or "200". Ranges keep the low end.
function parseAmount(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  let s = String(v).trim().replace(",", ".").replace(/\s*[-–]\s*[\d.]+.*$/, "");
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

function matchKey(s) {
  return String(s || "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Trust the model's fridgeItem only if it names something we sent.
function resolveFridgeItem(ing, haveByKey) {
  const claimed = matchKey(cleanText(ing.fridgeItem, 120));
  if (claimed && haveByKey.has(claimed)) return haveByKey.get(claimed);
  return null;
}

function normalizeRecipe(raw, haveByKey) {
  if (!raw || typeof raw !== "object") return null;
  const title = cleanText(raw.title, 120);
  if (!title) return null;

  let group = null;
  const ingredients = [];
  for (let ing of Array.isArray(raw.ingredients) ? raw.ingredients : []) {
    if (typeof ing === "string") ing = { name: ing };
    if (!ing || typeof ing !== "object") continue;
    const name = cleanText(ing.name, 120);
    if (!name) continue;
    // Groups ("For the sauce") are carried on each ingredient so the list
    // stays flat; the app draws a header where the group changes.
    if (ing.group !== undefined) group = cleanText(ing.group, 60) || null;
    const fridgeItem = resolveFridgeItem(ing, haveByKey);
    ingredients.push({
      name,
      amount: parseAmount(ing.amount),
      unit: cleanText(ing.unit, 20) || null,
      group,
      note: cleanText(ing.note, 80) || null,
      fridgeItem,
      inFridge: !!fridgeItem,
      pantry: !fridgeItem && (ing.pantry === true || ing.pantry === "true"),
    });
    if (ingredients.length >= 60) break;
  }

  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .map((s) => (s && typeof s === "object" ? s.text || s.instruction || s.step : s))
    .map((s) => cleanText(s, 800).replace(/^(?:step\s*)?\d+[.):]\s*/i, ""))
    .filter(Boolean)
    .slice(0, 40);

  if (ingredients.length === 0 || steps.length === 0) return null;

  const minutes = Math.round(Number(raw.totalMinutes));
  const servings = Math.round(Number(raw.servings));
  return {
    title,
    description: cleanText(raw.description, 300),
    totalMinutes: Number.isFinite(minutes) && minutes > 0 && minutes < 10_000 ? minutes : null,
    servings: Number.isFinite(servings) && servings > 0 && servings <= 100 ? servings : null,
    ingredients,
    steps,
  };
}

// ---------- prompt ----------

function buildPrompt(language, inventory, pageCount) {
  const system = `You read recipes from photos (cookbook pages, printouts, handwritten cards) and rewrite them in a clean, easy-to-follow format.
Output ONLY a JSON object, no markdown fences, matching exactly:
{
  "found": boolean,
  "recipe": {
    "title": "string",
    "description": "string",
    "servings": number|null,
    "totalMinutes": number|null,
    "ingredients": [
      { "name": "string", "amount": number|null, "unit": "string"|null, "group": "string"|null, "note": "string"|null, "pantry": boolean, "fridgeItem": "string"|null }
    ],
    "steps": ["string"]
  }
}
Rules:
- Transcribe the recipe faithfully in the language it is written in. Do NOT translate it, do not invent ingredients or steps, do not change amounts.
- If the photo is not a recipe or is unreadable, return {"found": false}.
- title: the recipe's own title. If none is written, give it a short fitting name.
- description: one short sentence in ${language} saying what the dish is. Empty string if unsure.
- servings: number of servings/persons if stated, else null. totalMinutes: total time if stated or clearly derivable from the times in the steps, else null.
- ingredients: one entry per ingredient, in the recipe's order.
  - amount: a number (convert "½" to 0.5, "1 1/2" to 1.5; for a range like "2-3" use the lower number). null if no amount ("salt to taste").
  - unit: the unit as written in short form (g, kg, dl, ml, l, tbsp, tsp, spsk, tsk, cup, stk, pcs, fed, ...). null if the amount is a count of the item itself ("3 eggs" → amount 3, unit null).
  - name: the ingredient only, without amount or unit, e.g. "hakket oksekød", "onion".
  - note: preparation or detail written next to it ("finely chopped", "room temperature"), else null.
  - group: the sub-heading the ingredient is listed under ("For the sauce", "Dej"), else null.
  - pantry: true only for basic staples most kitchens always have: salt, pepper, water, cooking oil, sugar, plain flour, butter for frying, vinegar, common dried spices.
- steps: the method as separate, numbered-in-order instructions. One action per step where the original runs several together. No numbering inside the text. Keep temperatures and times exactly.
- If handwriting is unclear, give your best reading; never leave out an ingredient because it is hard to read.`;

  let user = pageCount > 1
    ? `These ${pageCount} photos are pages of ONE recipe, in order. Combine them into a single recipe.`
    : "Read the recipe in this photo.";

  if (inventory.length) {
    user += `

The user currently has these items at home (freezer/fridge/pantry inventory):
${inventory.map((n) => `- ${n}`).join("\n")}

For each ingredient set "fridgeItem" to the EXACT name from this list of an item that can be used for it (e.g. ingredient "hakket oksekød" → item "Hakket kød 8-12%"), or null if none of the items fits. Be strict: "peber" is not "peberfrugt", "chicken stock" is not "chicken breast".`;
  } else {
    user += `\n\nSet "fridgeItem" to null for every ingredient.`;
  }
  return { system, user };
}

// ---------- Groq call ----------

async function callGroq(system, user, images, extraBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: user },
              ...images.map((b64) => ({
                type: "image_url",
                image_url: { url: b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}` },
              })),
            ],
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 4096,
        response_format: { type: "json_object" },
        ...extraBody,
      }),
    });
    const text = await res.text();
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 400)}` };
    let data;
    try { data = JSON.parse(text); } catch {
      return { error: `invalid JSON envelope: ${text.slice(0, 200)}` };
    }
    return { content: data?.choices?.[0]?.message?.content };
  } catch (e) {
    return { error: e?.name === "AbortError" ? `timed out after ${TIMEOUT_MS / 1000}s` : `fetch failed: ${String(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- rate limit (scans only: recipe_generation_log.kind = 'scan') ----------

async function getCallerUserId(req) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch { return null; }
}

async function countTodayScans(userId) {
  if (!supabaseAdmin) return 0;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabaseAdmin
    .from("recipe_generation_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "scan")
    .gte("created_at", start.toISOString());
  // Before ADD_SCANNED_RECIPES.sql has run there is no "kind" column: fail
  // open rather than blocking every scan.
  if (error) { console.error("scan rate-limit count failed:", error.message); return 0; }
  return count || 0;
}

async function logScan(userId) {
  if (!supabaseAdmin || !userId) return;
  const { error } = await supabaseAdmin
    .from("recipe_generation_log")
    .insert({ user_id: userId, kind: "scan" });
  if (error) console.error("scan rate-limit log insert failed:", error.message);
}

// ---------- handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!GROQ_API_KEY) return json({ error: "GROQ_API_KEY not set" }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const images = (Array.isArray(body?.images) ? body.images : [body?.imageBase64])
    .filter((s) => typeof s === "string" && s.length > 100)
    .slice(0, MAX_IMAGES);
  if (images.length === 0) return json({ error: "images required" }, 400);

  const language = LOCALE_NAMES[body?.locale] || "English";
  const inventory = [...new Set(
    (Array.isArray(body?.inventory) ? body.inventory : [])
      .map((n) => cleanText(n, 80))
      .filter(Boolean)
  )].slice(0, 250);

  const callerId = await getCallerUserId(req);
  const isBypassed = callerId && BYPASS_USERS.has(callerId);
  if (callerId && !isBypassed) {
    const used = await countTodayScans(callerId);
    if (used >= SCAN_DAILY_LIMIT) {
      return json({ error: "DAILY_LIMIT_REACHED", limit: SCAN_DAILY_LIMIT, used }, 429);
    }
  }

  const { system, user } = buildPrompt(language, inventory, images.length);

  // Qwen 3.x thinks before answering by default; that costs tokens and time
  // and can break JSON mode. Ask for no reasoning, and if Groq rejects the
  // parameter for this model, retry without it.
  let result = await callGroq(system, user, images, { reasoning_effort: "none" });
  if (result.status === 400) {
    console.warn("scan-recipe: retrying without reasoning_effort:", result.error);
    result = await callGroq(system, user, images, {});
  }
  if (result.error) {
    console.error("scan-recipe failed:", result.error);
    const status = result.status === 429 ? 503 : 502;
    return json({ error: "AI_FAILED", detail: result.error }, status);
  }

  const parsed = extractJson(result.content);
  const haveByKey = new Map(inventory.map((n) => [matchKey(n), n]));
  const recipe = parsed?.found === false ? null : normalizeRecipe(parsed?.recipe || parsed, haveByKey);

  if (!recipe) return json({ found: false, _model: VISION_MODEL });

  if (callerId && !isBypassed) await logScan(callerId);
  return json({ found: true, recipe, _model: VISION_MODEL });
});
