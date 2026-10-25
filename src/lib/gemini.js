// Gemini (Generative Language API) calls. The key never leaves this browser except to Google.

import { GLOSSARY } from './shorthand';
import { todayISO } from './util';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const modelId = m => (m || '').trim().replace(/^models\//, '');

export function parseJSON(t) {
  const s = t.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch {
    const a = s.search(/[[{]/), b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('could not read the model output');
  }
}

export async function generate(settings, prompt, { temperature = 0.2 } = {}) {
  if (!settings.apiKey) throw new Error('no API key');
  const r = await fetch(`${BASE}/models/${encodeURIComponent(modelId(settings.model))}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey.trim() },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature, responseMimeType: 'application/json' } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  const text = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
  if (!text) throw new Error(j.promptFeedback?.blockReason ? `blocked (${j.promptFeedback.blockReason})` : 'empty response');
  return parseJSON(text);
}

export async function listModels(apiKey) {
  const r = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': apiKey.trim() } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  return (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => m.name.replace(/^models\//, ''));
}

export const testConnection = settings => generate(settings, 'Reply with exactly {"ok":true}');

/* ---------- context builders ---------- */

const who = (ctx, from) => (from === 'owner' ? `${ctx.ownerName} (owner)` : `${ctx.clientName} (client)`);
function chat(p, ctx, include = [], limit = 600) {
  const keep = new Set(include);
  return p.messages.filter((m, i) => i >= p.messages.length - limit || keep.has(m.id)).map(m => ({
    id: m.id, from: who(ctx, m.from), at: new Date(m.ts).toISOString().slice(0, 16).replace('T', ' '),
    text: (m.text || '').slice(0, 1500),
    ...(m.attachments?.length ? { files: m.attachments.map(a => a.name) } : {}),
    ...(m.voice ? { voice_note_transcript: true } : {}),
  }));
}
function records(p) {
  return p.items.map(i => ({
    id: i.id, type: i.type, title: i.title, status: i.status,
    ...(i.detail ? { detail: i.detail.slice(0, 300) } : {}), ...(i.due ? { due: i.due } : {}),
    ...(i.category ? { category: i.category } : {}), ...(i.assignee ? { assignee: i.assignee } : {}),
    ...(i.type === 'requirement' ? { scope: i.scope, versions: i.versions.length } : {}),
    ...(i.type === 'file' && i.value ? { url: i.value } : {}),
    source_message: i.sourceMsg, changes: i.history.length - 1,
  }));
}
const today = () => `${todayISO()} (${new Date().toLocaleDateString('en-US', { weekday: 'long' })})`;

/** Shared by extraction and the assistant: what records exist and how to change them. */
const SCHEMA = `RECORD TYPES
- task: an action someone must do. assignee "owner" or "client" (who has to do it).
- requirement: what the deliverable must be/do/have (look, content, feature, constraint, preference). scope "in", or "out" if explicitly excluded / postponed.
- decision: an agreement or choice ("let's go with B", "approved", "lgtm", "ok do it"). The title must say WHAT was decided, using earlier messages for context.
- sensitive: passwords, PINs, logins/usernames, API keys, tokens, emails, phone numbers, addresses, bank/card numbers, budgets/prices/payments, personal or confidential details. value = the exact value as written. category = credential|contact|financial|personal|confidential. title = what it is for (e.g. "Staging password", "Sara's email", "Budget cap").
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
  const prompt = `You are the memory engine of "Project Brain", a private workspace where a freelancer (owner) talks with a client about one project.
You read the chat and propose structured records. Messages are casual: shorthand, abbreviations, typos, missing punctuation, mixed languages, emoji. Understand intent, not keywords.

SHORTHAND (non-exhaustive — infer similar ones): ${GLOSSARY}

Today is ${today()}. Convert relative dates ("by fri", "tmrw", "eow", "next mon", "in 2 days") to YYYY-MM-DD.

${SCHEMA}

RULES
- Only analyse messages whose id is in ANALYSE. Everything else is context.
- One message can produce several records — split combined requests.
- Never duplicate existing records; prefer update / status / note on them.
- Skip greetings, thanks and small talk.
- Titles: short and clear, in English, shorthand expanded, imperative for tasks, max ~12 words.
- msg = id of the message the record comes from. priority = high only when urgent.

Return JSON only: {"ops":[{"msg":"","op":"create|update|status|note","type":"","targetId":"","title":"","detail":"","value":"","category":"","status":"","priority":"low|normal|high","due":"","assignee":"","scope":"","replaces":"","reason":""}]}
Return {"ops":[]} when there is nothing to record.

PEOPLE: owner = ${ctx.ownerName}; client = ${ctx.clientName}
PROJECT: ${p.name}${p.description ? ' — ' + p.description : ''}
EXISTING RECORDS: ${JSON.stringify(records(p))}
ANALYSE: ${JSON.stringify(ids)}
CHAT: ${JSON.stringify(chat(p, ctx, ids))}`;
  const out = await generate(settings, prompt, { temperature: 0.1 });
  return Array.isArray(out) ? out : out.ops || [];
}

/* ---------- memory ---------- */

export async function summarize(settings, p, ctx) {
  const prev = p.summaries[p.summaries.length - 1];
  const prompt = `You maintain the living memory of a client project. From the full project record below, write the CURRENT state.
Records with status done/cancelled/delivered/dropped/replaced/superseded/revoked/answered/mitigated/closed/outdated are closed; the rest are still open.
Only state facts present in the record. Never include secret values (passwords, keys, card numbers) — refer to them by name. Expand shorthand. Be concise and concrete.

Return JSON only:
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

Today is ${today()}. Owner = ${ctx.ownerName}; client = ${ctx.clientName}. Project: ${p.name}${p.description ? ' — ' + p.description : ''}
PREVIOUS SUMMARY: ${prev ? JSON.stringify({ at: new Date(prev.ts).toISOString(), headline: prev.headline, overview: prev.overview }) : 'none'}
RECORDS: ${JSON.stringify(records(p))}
CHAT: ${JSON.stringify(chat(p, ctx, [], 400))}`;
  return generate(settings, prompt, { temperature: 0.3 });
}

/**
 * The project assistant: answers questions, proposes changes to the record and drafts messages.
 * It never changes anything itself — every proposed change becomes a suggestion the owner approves.
 */
export async function ask(settings, p, ctx, question, history = []) {
  const prompt = `You are the project assistant inside "Project Brain", working for the owner (${ctx.ownerName}) on a client project with ${ctx.clientName}.
You can do three things, alone or combined:
1. ANSWER questions using ONLY the project record below. If the record doesn't contain it, say so.
2. PROPOSE CHANGES to the record when the owner asks you to create, add, update, close, split, plan, prioritise, schedule or clean up anything
   (e.g. "create tasks for all risks", "which requirements have no task? add them", "mark the menu task done", "set due dates for the open tasks", "break X into subtasks").
   Put every change in "ops". You cannot apply them yourself: they appear as suggestions the owner approves with one click.
   So NEVER say something "has been created/updated" — say e.g. "I've proposed 11 tasks — review them below."
   Do not propose duplicates of existing open records. Link each op to its origin with msg = the source_message of the record or message it is based on (or "" if none).
3. DRAFT TEXT when asked to write something (a client update, a reply, an email, a meeting agenda, a summary to share).
   Put the ready-to-use text in "draft", written in the owner's voice, friendly and concise. Never include secret values.

Never reveal secret values (passwords, keys, card numbers) in "answer" or "draft"; point to the vault record by name instead.
SHORTHAND used in the chat: ${GLOSSARY}
Today is ${today()}. Convert relative dates to YYYY-MM-DD.

${SCHEMA}

Return JSON only:
{"answer":"short plain text for the owner (bullets with • allowed)","refs":["ids of records or messages used"],
 "ops":[{"msg":"","op":"create|update|status|note","type":"","targetId":"","title":"","detail":"","value":"","category":"","status":"","priority":"low|normal|high","due":"","assignee":"owner|client","scope":"","replaces":"","reason":"why"}],
 "draft":""}
Use "ops":[] and "draft":"" when not needed.

PROJECT: ${p.name}${p.description ? ' — ' + p.description : ''}
EARLIER IN THIS CONVERSATION WITH YOU: ${JSON.stringify(history.slice(-4).map(a => ({ q: a.question, a: a.answer.slice(0, 400) })))}
OWNER'S REQUEST: ${question}
RECORDS: ${JSON.stringify(records(p))}
CHAT: ${JSON.stringify(chat(p, ctx, [], 600))}`;
  return generate(settings, prompt, { temperature: 0.25 });
}
