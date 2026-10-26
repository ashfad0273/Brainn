// Orchestration: decide between the AI provider (Cloudflare or Gemini) and the built-in rules,
// then write results into the record. Any AI failure falls back to the rules.

import * as ai from './gemini';
import { extractLocal } from './extract';
import { prepareSuggestions, addSuggestions, log, liveView, activeMembers, primaryClient, recordReading } from './model';
import { getBlob } from './blobs';
import { readFile, docStats } from './docread';
import { createRedactor } from './redact';
import { TYPES, isActive, memberRole } from './meta';
import { uid, now, isOverdue, fmtDue } from './util';

/** Who is in the project, for prompts and the built-in rules. */
export function peopleOf(state, p) {
  const owner = state.settings.ownerName || 'Owner';
  const all = new Map((p.members || []).map(m => [m.id, m]));
  const clientName = primaryClient(p)?.name || p.client || 'Client';
  return {
    ownerName: owner, clientName,
    members: activeMembers(p).map(m => ({ id: m.id, name: m.name, role: memberRole(m) })),
    /** Display name and role of whoever wrote a message. */
    nameOf: m => (m.from === 'owner' ? owner : all.get(m.memberId)?.name || clientName),
    roleOf: m => (m.from === 'owner' ? 'owner' : all.get(m.memberId) ? memberRole(all.get(m.memberId)).toLowerCase() : 'client'),
  };
}
/** True when an AI provider is configured; aiName() is its display name. */
export const aiOn = s => ai.aiReady(s);
export const aiName = s => (ai.aiReady(s) ? ai.PROVIDERS[ai.providerOf(s)] : ai.PROVIDERS.rules);

/** Read the given messages and add new suggestions. Returns {count, engine}. */
export async function analyze({ state, project, ids, mutate, toast, latest }) {
  const p = liveView(project);
  const ctx = peopleOf(state, p);
  let ops = null, engine = 'rules';
  if (aiOn(state.settings)) {
    try { ops = await ai.extract(state.settings, p, ids, ctx); engine = ai.providerOf(state.settings); }
    catch (e) { toast?.(`${aiName(state.settings)}: ${e.message}. Used built-in rules instead.`, 'error'); }
  }
  if (!ops) ops = ids.flatMap(id => { const m = p.messages.find(x => x.id === id); return m ? extractLocal(p, m, ctx) : []; });
  // The AI call takes a while: check against the record as it is now (other runs and tabs may have added the same thing),
  // and once more inside the update itself.
  const fresh = prepareSuggestions(latest?.() || project, ops, engine);
  mutate(p.id, q => {
    const added = addSuggestions(q, fresh);
    q.messages.forEach(m => { if (ids.includes(m.id)) m.analyzed = true; });
    if (added.length) log(q, 'system', 'suggestions.add', null, { count: added.length, engine });
  });
  return { count: fresh.length, engine };
}

const pt = (text, refs = []) => ({ text, refs });

/** Summary built from the structured records alone (no AI). */
export function localSummary(p) {
  const by = t => p.items.filter(i => i.type === t);
  const tasks = by('task'), open = tasks.filter(isActive), done = tasks.filter(t => t.status === 'done');
  const reqs = by('requirement').filter(isActive), decs = by('decision').filter(isActive);
  const lastTs = it => it.history[it.history.length - 1].ts;
  const overdue = open.filter(t => isOverdue(t.due));
  const pending = p.suggestions.filter(s => s.state === 'pending');
  const changes = p.items.flatMap(i => i.history.filter(h => h.action !== 'created').map(h => ({ i, h })))
    .sort((a, b) => b.h.ts - a.h.ts).slice(0, 6)
    .map(({ i, h }) => pt(h.action === 'status' ? `${TYPES[i.type].label} “${i.title}” → ${h.to.replace('_', ' ')}` : h.action === 'edit' ? `${TYPES[i.type].label} “${i.title}” updated (${h.field})` : `Note on “${i.title}”`, [i.id]));
  return {
    headline: `${done.length} of ${tasks.length} tasks done · ${open.length} open · ${reqs.length} active requirements`,
    overview: [
      p.description || `Project with ${p.client || 'the client'}.`,
      `${p.messages.length} messages so far; ${decs.length} decision${decs.length === 1 ? '' : 's'} on record.`,
      open.length ? `Next up: ${open.slice(0, 3).map(t => t.title).join('; ')}.` : 'No open tasks right now.',
      overdue.length ? `${overdue.length} task${overdue.length === 1 ? ' is' : 's are'} overdue.` : '',
    ].filter(Boolean).join(' '),
    keyFacts: [...reqs.slice(0, 8).map(r => pt(r.scope === 'out' ? `Out of scope: ${r.title}` : r.title, [r.id])), ...decs.slice(-4).map(d => pt('Decided: ' + d.title, [d.id]))],
    done: done.sort((a, b) => lastTs(b) - lastTs(a)).slice(0, 8).map(t => pt(t.title, [t.id])),
    inProgress: open.filter(t => t.status === 'in_progress').map(t => pt(t.title, [t.id])),
    next: open.filter(t => t.status !== 'in_progress').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
      .slice(0, 8).map(t => pt(t.title + (t.due ? ` — due ${fmtDue(t.due)}` : ''), [t.id])),
    openQuestions: by('question').filter(isActive).map(q => pt(q.title, [q.id])),
    risks: [
      ...overdue.map(t => pt(`Overdue: ${t.title}`, [t.id])),
      ...open.filter(t => t.status === 'blocked').map(t => pt(`Blocked: ${t.title}`, [t.id])),
      ...by('risk').filter(isActive).map(r => pt(r.title, [r.id])),
      ...(pending.length > 4 ? [pt(`${pending.length} suggestions waiting for review`)] : []),
    ],
    recentChanges: changes,
  };
}

const LISTS = ['keyFacts', 'done', 'inProgress', 'next', 'openQuestions', 'risks', 'recentChanges'];
function cleanSummary(raw, p) {
  const ids = new Set([...p.items.map(i => i.id), ...p.messages.map(m => m.id)]);
  const out = { headline: String(raw.headline || '').slice(0, 300), overview: String(raw.overview || '').slice(0, 3000) };
  for (const k of LISTS) {
    out[k] = (Array.isArray(raw[k]) ? raw[k] : []).map(x => (typeof x === 'string' ? pt(x) : pt(String(x?.text || ''), (x?.refs || []).filter(r => ids.has(r))))).filter(x => x.text);
  }
  return out;
}

export async function refreshMemory({ state, project, mutate, toast }) {
  const p = liveView(project);
  let data, engine = 'rules';
  if (aiOn(state.settings)) {
    try { data = cleanSummary(await ai.summarize(state.settings, p, peopleOf(state, p)), p); engine = ai.providerOf(state.settings); }
    catch (e) { toast?.(`${aiName(state.settings)}: ${e.message}. Built a summary from the records instead.`, 'error'); }
  }
  if (!data) data = localSummary(p);
  const sum = { id: uid('sum'), ts: now(), engine, basedOn: { messages: p.messages.length, events: p.log.length }, ...data };
  mutate(p.id, q => { q.summaries.push(sum); log(q, 'owner', 'memory.refresh', sum.id, { engine }); });
  return sum;
}


/**
 * Read an uploaded file with the provider the owner picked ('gemini' | 'cloudflare'):
 * extract it in the browser → structured JSON → redact → AI → suggestions + a description on the file record.
 * vision: also let Gemini see the picture(s) themselves (raw pixels can't be redacted, so this is opt-in).
 */
export async function readAttachment({ state, project, message, attachment, provider, vision = false, mutate, latest, onProgress }) {
  const settings = { ...state.settings, provider };
  if (!ai.aiReady(settings)) throw new Error(`${ai.PROVIDERS[provider]} is not set up — add it in Settings first`);
  const blob = await getBlob(attachment.id);
  if (!blob) throw new Error('No stored copy of this file');
  onProgress?.('Reading the file in your browser…');
  const { doc, vision: images } = await readFile(blob, attachment, { onProgress, vision: vision && provider === 'gemini' });
  if (!doc.blocks.length) throw new Error('No text or structure could be read from this file');
  onProgress?.(`Sending the structured text to ${ai.PROVIDERS[provider]} (secrets redacted)…`);
  const p = liveView(project);
  const res = await ai.readDocument(settings, p, peopleOf(state, p), { doc, message, images: vision ? images : [] });
  const fresh = prepareSuggestions(latest?.() || project, res.ops, provider, { attachment: attachment.id });
  // keep what was sent, with secrets masked, so the owner can see exactly what the AI read
  const R = createRedactor(p);
  let sent = R.mask(R.deep(doc));
  if (JSON.stringify(sent).length > 150000) sent = { ...sent, blocks: sent.blocks.slice(0, 400), truncated: true };
  let added = [];
  mutate(project.id, q => {
    added = addSuggestions(q, fresh);
    if (added.length) log(q, 'system', 'suggestions.add', null, { count: added.length, engine: provider, file: attachment.name });
    const item = q.items.find(i => i.file?.attachmentId === attachment.id && !i.deleted);
    if (item) {
      recordReading(q, 'owner', item.id, {
        engine: provider, vision: !!(vision && images.length), description: res.description, imageContext: res.imageContext,
        stats: docStats(doc), suggestions: fresh.length, truncated: res.truncated, doc: sent,
      });
    }
  });
  return { count: fresh.length, description: res.description, imageContext: res.imageContext, stats: docStats(doc), truncated: res.truncated, doc: sent };
}
