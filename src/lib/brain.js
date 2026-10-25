// Orchestration: decide between Gemini and the built-in rules, then write results into the record.

import * as gemini from './gemini';
import { extractLocal } from './extract';
import { prepareSuggestions, log } from './model';
import { TYPES, isActive } from './meta';
import { uid, now, overlap, isOverdue, fmtDue } from './util';

export const peopleOf = (state, p) => ({ ownerName: state.settings.ownerName || 'Owner', clientName: p.invite?.name || p.client || 'Client' });
export const geminiOn = s => !!(s.apiKey && s.useGemini);

/** Read the given messages and add new suggestions. Returns {count, engine}. */
export async function analyze({ state, project: p, ids, mutate, toast }) {
  const ctx = peopleOf(state, p);
  let ops = null, engine = 'rules';
  if (geminiOn(state.settings)) {
    try { ops = await gemini.extract(state.settings, p, ids, ctx); engine = 'gemini'; }
    catch (e) { toast?.(`Gemini: ${e.message}. Used built-in rules instead.`, 'error'); }
  }
  if (!ops) ops = ids.flatMap(id => { const m = p.messages.find(x => x.id === id); return m ? extractLocal(p, m, ctx) : []; });
  const fresh = prepareSuggestions(p, ops, engine);
  mutate(p.id, q => {
    const known = new Set(q.suggestions.map(s => s.id));
    fresh.forEach(s => !known.has(s.id) && q.suggestions.push(s));
    q.messages.forEach(m => { if (ids.includes(m.id)) m.analyzed = true; });
    if (fresh.length) log(q, 'system', 'suggestions.add', null, { count: fresh.length, engine });
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

export async function refreshMemory({ state, project: p, mutate, toast }) {
  let data, engine = 'rules';
  if (geminiOn(state.settings)) {
    try { data = cleanSummary(await gemini.summarize(state.settings, p, peopleOf(state, p)), p); engine = 'gemini'; }
    catch (e) { toast?.(`Gemini: ${e.message}. Built a summary from the records instead.`, 'error'); }
  }
  if (!data) data = localSummary(p);
  const sum = { id: uid('sum'), ts: now(), engine, basedOn: { messages: p.messages.length, events: p.log.length }, ...data };
  mutate(p.id, q => { q.summaries.push(sum); log(q, 'owner', 'memory.refresh', sum.id, { engine }); });
  return sum;
}

