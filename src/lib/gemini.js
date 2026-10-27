// AI calls for Project Brain. Two providers:
//   gemini     – Google Generative Language API, called from the browser with the user's key
//   cloudflare – the user's own Worker in front of Workers AI (see /worker)
// Everything sent is redacted first (lib/redact): secrets become [SECRET_n] placeholders.

import { GLOSSARY } from './shorthand';
import { todayISO } from './util';
import { createRedactor } from './redact';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const modelId = m => (m || '').trim().replace(/^models\//, '');

/* ---------- providers ---------- */

export const PROVIDERS = { rules: 'Built-in rules', cloudflare: 'Cloudflare AI', gemini: 'Gemini' };
/** Older workspaces only had a Gemini key + toggle; derive the provider from that. */
export const providerOf = s => s.provider || (s.apiKey && s.useGemini ? 'gemini' : 'rules');
export function aiReady(s) {
  const pv = providerOf(s);
  if (pv === 'gemini') return !!s.apiKey;
  if (pv === 'cloudflare') return !!(s.workerUrl && s.workerToken);
  return false;
}
/** Label for an engine stored on a suggestion / summary / answer. */
export const engineName = (e, fallback = 'built-in rules') => (e === 'gemini' ? 'Gemini' : e === 'cloudflare' ? 'Cloudflare AI' : fallback);
/** Smaller context for Workers AI models. */
const budget = s => (providerOf(s) === 'cloudflare' ? { chat: 80, text: 700, records: 150, glossary: false } : { chat: 600, text: 1500, records: 1000, glossary: true });

class BadJSON extends Error {}
export function parseJSON(t) {
  const s = String(t).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch {
    const a = s.search(/[[{]/), b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* fall through */ } }
    throw new BadJSON('the model did not return valid JSON');
  }
}

/** images: [{ mime, data (base64) }] — only sent when the owner explicitly lets Gemini see a file. */
async function callGemini(settings, prompt, temperature, images = []) {
  if (!settings.apiKey) throw new Error('no Gemini API key');
  const parts = [{ text: prompt }, ...images.map(im => ({ inline_data: { mime_type: im.mime, data: im.data } }))];
  const r = await fetch(`${BASE}/models/${encodeURIComponent(modelId(settings.model))}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey.trim() },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature, responseMimeType: 'application/json' } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const text = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  if (!text) throw new Error(j.promptFeedback?.blockReason ? `blocked (${j.promptFeedback.blockReason})` : 'empty response');
  return text;
}

/** Header values must be printable ASCII without spaces. */
export const badTokenChar = t => /[^\x21-\x7E]/.test((t || '').trim());
const workerEndpoint = url => url.trim().replace(/\/+$/, '').replace(/\/v1\/generate$/, '') + '/v1/generate';
const SYSTEM_JSON = 'You are a precise assistant that replies with a single valid JSON object and nothing else — no prose, no markdown fences.';

async function callCloudflare(settings, prompt, temperature, schema) {
  if (!settings.workerUrl || !settings.workerToken) throw new Error('Worker URL and token are not set');
  if (badTokenChar(settings.workerToken)) throw new Error('the token contains spaces or characters that can’t be sent in a request — use only letters, numbers and ASCII symbols');
  let r;
  try {
    r = await fetch(workerEndpoint(settings.workerUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.workerToken.trim()}` },
      body: JSON.stringify({ prompt, system: SYSTEM_JSON, model: settings.cfModel || undefined, schema, temperature, maxTokens: 3000 }),
    });
  } catch (e) {
    throw new Error(`could not reach the Worker from ${location.origin} (${e.message}). Check the URL, and that “${location.origin}” is listed in ALLOWED_ORIGINS in worker/wrangler.toml`);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Worker HTTP ${r.status}`);
  return j.output;
}

/** Ask the configured provider for JSON. Retries once when the reply isn't valid JSON. */
export async function generate(settings, prompt, { temperature = 0.2, schema, images } = {}) {
  const pv = providerOf(settings);
  if (images?.length && pv !== 'gemini') throw new Error('only Gemini can look at images');
  const once = async text => {
    const out = pv === 'cloudflare' ? await callCloudflare(settings, text, temperature, schema) : await callGemini(settings, text, temperature, images);
    return out && typeof out === 'object' ? out : parseJSON(out ?? '');
  };
  try { return await once(prompt); } catch (e) {
    if (!(e instanceof BadJSON)) throw e;
    return once(`${prompt}\n\nIMPORTANT: your previous reply was not valid JSON. Reply again with ONLY the JSON object described above.`);
  }
}

/** Free-form text generation (drafting messages, rephrasing selection). */
export async function generateText(settings, prompt, { system = 'You are an expert communication assistant for project management. Keep tone natural, polite, and concise. Return ONLY the final message or rephrased text with no quotation marks, labels, or meta-commentary.', temperature = 0.4 } = {}) {
  const pv = providerOf(settings);
  if (pv === 'cloudflare') {
    if (!settings.workerUrl || !settings.workerToken) throw new Error('Worker URL and token are not set in Settings → AI');
    let r;
    try {
      r = await fetch(workerEndpoint(settings.workerUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.workerToken.trim()}` },
        body: JSON.stringify({ prompt, system, model: settings.cfModel || undefined, temperature, maxTokens: 2000 }),
      });
    } catch (e) {
      throw new Error(`Could not reach AI Worker (${e.message})`);
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Worker HTTP ${r.status}`);
    return (j.output || '').trim();
  }

  if (!settings.apiKey) throw new Error('no Gemini API key');
  const r = await fetch(`${BASE}/models/${encodeURIComponent(modelId(settings.model))}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey.trim() },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: (system ? system + '\n\n' : '') + prompt }] }], generationConfig: { temperature } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const text = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  return text.trim();
}

export async function listModels(apiKey) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey.trim() } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
}

export async function testConnection(settings) {
  const out = await generate(settings, 'Reply with exactly this JSON: {"ok":true}', { schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } });
  if (!out || out.ok !== true) throw new Error('unexpected reply from the model');
  return true;
}

/* ---------- JSON schemas (Workers AI JSON mode) ---------- */

const str = { type: 'string' };
const OP = { type: 'object', properties: Object.fromEntries(['msg', 'op', 'type', 'targetId', 'title', 'detail', 'value', 'category', 'status', 'priority', 'due', 'assignee', 'scope', 'replaces', 'reason', 'quote'].map(k => [k, str])), required: ['op', 'type', 'title'] };
const POINTS = { type: 'array', items: { type: 'object', properties: { text: str, refs: { type: 'array', items: str } }, required: ['text'] } };
const OPS_SCHEMA = { type: 'object', properties: { ops: { type: 'array', items: OP } }, required: ['ops'] };
const SUMMARY_SCHEMA = { type: 'object', properties: { headline: str, overview: str, ...Object.fromEntries(['keyFacts', 'done', 'inProgress', 'next', 'openQuestions', 'risks', 'recentChanges'].map(k => [k, POINTS])) }, required: ['headline', 'overview'] };
const ASK_SCHEMA = { type: 'object', properties: { answer: str, refs: { type: 'array', items: str }, ops: { type: 'array', items: OP }, draft: str }, required: ['answer'] };

/* ---------- context builders (always redacted) ---------- */

const who = (ctx, m) => `${ctx.nameOf(m)} (${ctx.roleOf(m)})`;
/** The people line of a prompt: owner, members with their roles, and how to assign work to them. */
const people = ctx => `PEOPLE: owner = ${ctx.ownerName}${ctx.members.length ? '; members: ' + ctx.members.map(m => `${m.name} (${m.role}, id ${m.id})`).join(', ') : `; client = ${ctx.clientName}`}
assignee = "owner", "client"${ctx.members.length ? ', or a member id' : ''} (who has to do it).`;
function chat(p, ctx, R, b, include = [], limit = b.chat) {
  const keep = new Set(include);
  return p.messages.filter((m, i) => i >= p.messages.length - limit || keep.has(m.id)).map(m => ({
    id: m.id, from: who(ctx, m), at: new Date(m.ts).toISOString().slice(0, 16).replace('T', ' '),
    text: R.text((m.text || '').slice(0, b.text)),
    ...(m.attachments?.length ? { files: m.attachments.map(a => a.name) } : {}),
    ...(m.voice ? { voice_note_transcript: true } : {}),
  }));
}
function records(p, R, b) {
  return p.items.slice(-b.records).map(i => ({
    id: i.id, type: i.type, title: R.text(i.title), status: i.status,
    ...(i.detail ? { detail: R.text(i.detail.slice(0, 300)) } : {}), ...(i.due ? { due: i.due } : {}),
    ...(i.category ? { category: i.category } : {}), ...(i.assignee ? { assignee: i.assignee } : {}),
    ...(i.type === 'requirement' ? { scope: i.scope, versions: i.versions.length } : {}),
    ...(i.type === 'file' && i.value ? { url: R.text(i.value) } : {}),
    source_message: i.sourceMsg, changes: i.history.length - 1,
  }));
}
const today = () => `${todayISO()} (${new Date().toLocaleDateString('en-US', { weekday: 'long' })})`;
const shorthand = b => (b.glossary ? `SHORTHAND (non-exhaustive — infer similar ones): ${GLOSSARY}` : 'Messages use chat shorthand (pwd/pw/pass = password, stg = staging, info = details, doc/txt = document, mail = email, tmrw = tomorrow, eow = end of week, pls = please, nvm = cancel, lgtm = approved) — infer similar ones.');
const REDACTED = 'Values shown as [SECRET_n] are secrets hidden for privacy. Never guess them; when one is a record value, copy the placeholder exactly.';

/** Shared by extraction and the assistant: what records exist and how to change them. */
const SCHEMA = `RECORD TYPES
- task: an action someone must do. assignee "owner" or "client" (who has to do it).
- requirement: what the deliverable must be/do/have (look, content, feature, constraint, preference). scope "in", or "out" if explicitly excluded / postponed.
- decision: an agreement or choice ("let's go with B", "approved", "lgtm", "ok do it"). The title must say WHAT was decided, using earlier messages for context.
- sensitive: passwords, PINs, logins/usernames, API keys, tokens, emails, phone numbers, addresses, bank/card numbers, budgets/prices/payments, personal or confidential details. value = the exact value as written. category = credential|contact|financial|personal|confidential.
  * CRITICAL FOR CREDENTIALS: When a login/password/account is shared, NEVER use generic titles like "Password" or "Login". Look at the preceding chat to determine the specific service, tool, website, or account requested (e.g. "WordPress Admin Access", "Shopify Store Login", "Staging Server cPanel", or domain name).
  * BUNDLE TOGETHER: Store the secret/password in value. Store username/email and URL (if shared or mentioned) in detail (e.g. detail: "Username: admin\\nURL: https://example.com/wp-admin"). Do NOT create separate fragmented items for username and password.
- question: a question that is still unanswered.
- risk: something that may hurt the project (tight deadline, blocker, unclear scope, budget pressure).
- file: a shared URL (value = the URL, category e.g. Design files, Documents, Environments, Shared drives, Links). Uploaded files are already recorded — never repeat them.

OPERATIONS
- create: a new record.
- update: an EXISTING record changed (client changed their mind, deadline moved, requirement refined). Give targetId plus the NEW title/detail/due; reason = what changed.
- status: an existing record's state changed: task finished ("done", "sent", "fixed", "uploaded", "it's live") → "done"; "nvm"/"cancel that" → "cancelled"; question answered → "answered"; requirement delivered → "delivered"; decision reversed → "reversed".
- note: attach a remark to an existing record (e.g. a task affected by a changed requirement). title = the note.
A new value for something that already exists (new password, new budget) → create with replaces = the old record id.
Allowed statuses: task(open,in_progress,blocked,done,cancelled) requirement(active,delivered,dropped) decision(active,reversed,superseded) sensitive(active,replaced,revoked) question(open,answered,dropped) risk(open,mitigated,closed) file(active,outdated).`;

/* ---------- extraction ---------- */

export async function extract(settings, p, ids, ctx) {
  const R = createRedactor(p), b = budget(settings);
  const prompt = `You are the memory engine of "Project Brain", a private workspace where a freelancer (owner) talks with a client about one project.
You read the chat and propose structured records. Messages are casual: shorthand, abbreviations, typos, missing punctuation, mixed languages, emoji. Understand intent, not keywords.

${shorthand(b)}
${REDACTED}

Today is ${today()}. Convert relative dates ("by fri", "tmrw", "eow", "next mon", "in 2 days") to YYYY-MM-DD.

${SCHEMA}

RULES
- Only analyse messages whose id is in ANALYSE. Everything else is context.
- One message can produce several records — split combined requests.
- Never duplicate existing records; prefer update / status / note on them.
- Skip greetings, thanks and small talk.
- Titles: short and clear, in English, shorthand expanded, imperative for tasks, max ~12 words.
- msg = id of the message the record comes from. priority = high only when urgent.
- quote = the exact words of that message the record comes from, copied character for character (a phrase or sentence, not the whole message). Keep [SECRET_n] placeholders as they are.

Return ONLY this JSON object, nothing else: {"ops":[{"msg":"","quote":"","op":"create|update|status|note","type":"","targetId":"","title":"","detail":"","value":"","category":"","status":"","priority":"low|normal|high","due":"","assignee":"","scope":"","replaces":"","reason":""}]}
Return {"ops":[]} when there is nothing to record.

${people(ctx)}
PROJECT: ${p.name}${p.description ? ' — ' + R.text(p.description) : ''}
EXISTING RECORDS: ${JSON.stringify(records(p, R, b))}
ANALYSE: ${JSON.stringify(ids)}
CHAT: ${JSON.stringify(chat(p, ctx, R, b, ids))}`;
  const out = await generate(settings, prompt, { temperature: 0.1, schema: OPS_SCHEMA });
  return unredactOps(R, Array.isArray(out) ? out : out.ops);
}

/** Only an op's value (what goes into the vault) gets the real secret back; titles and reasons stay masked. */
/** quoteRaw (the quote with real values) is only used locally to find the passage in the message; it is never stored. */
const unredactOps = (R, ops) => (Array.isArray(ops) ? ops : []).filter(o => o && typeof o === 'object')
  .map(o => ({ ...R.mask(o), value: R.restore(o.value ?? ''), quoteRaw: R.restore(String(o.quote ?? '')) }));

/* ---------- memory ---------- */

export async function summarize(settings, p, ctx) {
  const R = createRedactor(p), b = budget(settings);
  const prev = p.summaries[p.summaries.length - 1];
  const prompt = `You maintain the living memory of a client project. From the full project record below, write the CURRENT state.
Records with status done/cancelled/delivered/dropped/replaced/superseded/revoked/answered/mitigated/closed/outdated are closed; the rest are still open.
Only state facts present in the record. Never include secret values — refer to them by name. ${REDACTED} Expand shorthand. Be concise and concrete.

Return ONLY this JSON object, nothing else:
{"headline":"one sentence on where the project stands",
 "overview":"3-6 sentences: what the project is, progress, what changed recently, what matters next",
 "keyFacts":[{"text":"","refs":[]}],
 "done":[{"text":"","refs":[]}],
 "inProgress":[{"text":"","refs":[]}],
 "next":[{"text":"","refs":[]}],
 "openQuestions":[{"text":"","refs":[]}],
 "risks":[{"text":"","refs":[]}],
 "recentChanges":[{"text":"","refs":[]}]}
refs = ids of the records or messages backing each point. keyFacts = small but critical details that must never be forgotten (preferences, constraints, limits).

Today is ${today()}. Owner = ${ctx.ownerName}; client = ${ctx.clientName}. Project: ${p.name}${p.description ? ' — ' + R.text(p.description) : ''}
PREVIOUS SUMMARY: ${prev ? JSON.stringify({ at: new Date(prev.ts).toISOString(), headline: R.text(prev.headline), overview: R.text(prev.overview) }) : 'none'}
RECORDS: ${JSON.stringify(records(p, R, b))}
CHAT: ${JSON.stringify(chat(p, ctx, R, b, [], Math.min(400, b.chat)))}`;
  return R.mask(await generate(settings, prompt, { temperature: 0.3, schema: SUMMARY_SCHEMA }));
}

/**
 * The project assistant: answers questions, proposes changes to the record and drafts messages.
 * It never changes anything itself — every proposed change becomes a suggestion the owner approves.
 * Returned ops get real values restored; answer and draft keep secrets masked.
 */
export async function ask(settings, p, ctx, question, history = []) {
  const R = createRedactor(p), b = budget(settings);
  const prompt = `You are the project assistant inside "Project Brain", working for the owner (${ctx.ownerName}) on a client project with ${ctx.clientName}.
You can do three things, alone or combined:
1. ANSWER questions using ONLY the project record below. If the record doesn't contain it, say so.
2. PROPOSE CHANGES to the record when the owner asks you to create, add, update, close, split, plan, prioritise, schedule or clean up anything
   (e.g. "create tasks for all risks", "which requirements have no task? add them", "mark the menu task done", "set due dates for the open tasks", "break X into subtasks").
   Put every change in "ops". You cannot apply them yourself: they appear as suggestions the owner approves with one click.
   So NEVER say something "has been created/updated" — say e.g. "I've proposed 11 tasks — review them below."
   Do not propose duplicates of existing open records. Link each op to its origin with msg = the source_message of the record or message it is based on (or "" if none).
3. DRAFT TEXT when asked to write something (a client update, a reply, an email, a meeting agenda, a summary to share).
   Put the ready-to-use text in "draft", written in the owner's voice, friendly and concise.

Never reveal secret values in "answer" or "draft"; point to the vault record by name instead. ${REDACTED}
${shorthand(b)}
Today is ${today()}. Convert relative dates to YYYY-MM-DD.

${SCHEMA}

Return ONLY this JSON object, nothing else:
{"answer":"short plain text for the owner (bullets with • allowed)","refs":["ids of records or messages used"],
 "ops":[{"msg":"","quote":"exact words from that message, if any","op":"create|update|status|note","type":"","targetId":"","title":"","detail":"","value":"","category":"","status":"","priority":"low|normal|high","due":"","assignee":"owner|client|member id","scope":"","replaces":"","reason":"why"}],
 "draft":""}
Use "ops":[] and "draft":"" when not needed.

${people(ctx)}

PROJECT: ${p.name}${p.description ? ' — ' + R.text(p.description) : ''}
EARLIER IN THIS CONVERSATION WITH YOU: ${JSON.stringify(history.slice(-4).map(a => ({ q: R.text(a.question), a: R.text(a.answer.slice(0, 400)) })))}
OWNER'S REQUEST: ${R.text(question)}
RECORDS: ${JSON.stringify(records(p, R, b))}
CHAT: ${JSON.stringify(chat(p, ctx, R, b))}`;
  const out = await generate(settings, prompt, { temperature: 0.25, schema: ASK_SCHEMA });
  return { ...R.mask(out), ops: unredactOps(R, out.ops) };
}

/* ---------- reading an uploaded file ---------- */

const DOC_SCHEMA = { type: 'object', properties: { description: str, imageContext: str, ops: { type: 'array', items: OP } }, required: ['description'] };
/** How much of the document JSON fits: Workers AI text models have a much smaller context. */
const docBudget = s => (providerOf(s) === 'cloudflare' ? 14000 : 300000);

/** Keep whole blocks until the budget is used up, so the JSON stays valid and readable. */
function fitDoc(doc, max) {
  const out = { ...doc, blocks: [] };
  let used = JSON.stringify({ ...doc, blocks: [] }).length;
  for (const b of doc.blocks || []) {
    const n = JSON.stringify(b).length + 1;
    if (used + n > max) { out.truncated = true; out.blocksLeftOut = (doc.blocks.length - out.blocks.length); break; }
    out.blocks.push(b);
    used += n;
  }
  return out;
}

/**
 * Read one uploaded file. `doc` is the structured JSON built in the browser (lib/docread): headings,
 * paragraphs with bold/underlined phrases, lists, tables and images (OCR text). It is redacted here,
 * like everything else sent. `images` (Gemini only) are the raw pictures the owner chose to share.
 * → { description, imageContext, ops } with ops tied to the message the file came with.
 */
export async function readDocument(settings, p, ctx, { doc, message, images = [] }) {
  const R = createRedactor(p), b = budget(settings);
  const safe = fitDoc(R.deep(doc), docBudget(settings));
  const prompt = `You are the memory engine of "Project Brain", a private workspace where a freelancer (owner) works with a client and their team on one project.
A file was shared in the project chat. It was converted in the browser into structured JSON: headings (level), paragraphs (bold / underline = phrases that were bold or underlined), lists, tables (rows of cells) and images (ocrText = text read from the image; it may be empty or noisy).${images.length ? '\nThe image itself is attached as well — describe what it shows.' : ''}
${REDACTED}
${shorthand(b)}
Today is ${today()}. Convert relative dates to YYYY-MM-DD.

${SCHEMA}

RULES
- Propose records only for what the FILE says: tasks, requirements, decisions, sensitive details, questions, risks, links.
- Never duplicate existing records; prefer update / status / note on them.
- quote = the exact words from the FILE each record comes from (copied as written).
- msg = "${message.id}" for every op.

Return ONLY this JSON object, nothing else:
{"description":"2-4 sentences: what this file is and what matters in it",
 "imageContext":"what the images / visual parts show and how they relate to the project ('' if there are none)",
 "ops":[{"msg":"${message.id}","quote":"","op":"create|update|status|note","type":"","targetId":"","title":"","detail":"","value":"","category":"","status":"","priority":"low|normal|high","due":"","assignee":"","scope":"","replaces":"","reason":""}]}

${people(ctx)}
PROJECT: ${p.name}${p.description ? ' — ' + R.text(p.description) : ''}
EXISTING RECORDS: ${JSON.stringify(records(p, R, b))}
MESSAGE THE FILE CAME WITH: ${JSON.stringify({ id: message.id, from: who(ctx, message), text: R.text((message.text || '').slice(0, b.text)) })}
FILE: ${JSON.stringify(safe)}`;
  const out = await generate(settings, prompt, { temperature: 0.15, schema: DOC_SCHEMA, images });
  return {
    description: R.mask(String(out.description || '')).slice(0, 3000),
    imageContext: R.mask(String(out.imageContext || '')).slice(0, 3000),
    ops: unredactOps(R, out.ops).map(o => ({ ...o, msg: message.id })),
    truncated: !!safe.truncated,
  };
}
