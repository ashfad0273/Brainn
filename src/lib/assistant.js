// The project assistant: answers questions, proposes changes (as suggestions the owner approves)
// and drafts messages. Uses Gemini when a key is set, otherwise the built-in commands below.

import * as gemini from './gemini';
import { prepareSuggestions, log, secretValues, maskText } from './model';
import { TYPES, isActive } from './meta';
import { expand } from './shorthand';
import { uid, now, overlap, isOverdue, fmtDue } from './util';
import { peopleOf, geminiOn } from './brain';

const TASK_FROM = {
  risk: t => `Address risk: ${t}`,
  question: t => `Get an answer: ${t.replace(/\?+$/, '')}`,
  requirement: t => `Implement: ${t}`,
  decision: t => `Apply decision: ${t}`,
};
const hasTaskFor = (p, title) => p.items.some(i => {
  if (i.type !== 'task' || i.status === 'cancelled') return false;
  const o = overlap(title, i.title);
  return o.inter >= 2 && o.score >= 0.6;
});
const firstName = s => (s || '').split(' ')[0];
const bullets = (items, fmt = i => i.title) => items.map(i => '• ' + fmt(i)).join('\n');

function progressDraft(p, ctx) {
  const tasks = p.items.filter(i => i.type === 'task');
  const week = Date.now() - 7 * 86400000;
  const done = tasks.filter(t => t.status === 'done' && t.updatedAt > week);
  const next = tasks.filter(t => isActive(t) && t.assignee !== 'client').sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 5);
  const waiting = [...tasks.filter(t => isActive(t) && t.assignee === 'client'), ...p.items.filter(i => i.type === 'question' && isActive(i))];
  return [
    `Hi ${firstName(ctx.clientName)}, quick update on ${p.name}:`,
    done.length && `\n✅ Done this week\n${bullets(done)}`,
    next.length && `\n🔨 Up next\n${bullets(next, t => t.title + (t.due ? ` (by ${fmtDue(t.due)})` : ''))}`,
    waiting.length && `\n🙋 Waiting on you\n${bullets(waiting)}`,
    '\nLet me know if anything has changed!',
  ].filter(Boolean).join('\n');
}

function agendaDraft(p) {
  const by = t => p.items.filter(i => i.type === t && isActive(i));
  const done = p.items.filter(i => i.type === 'task' && i.status === 'done').slice(-5);
  const or = s => s || '• —';
  return [
    `Agenda — ${p.name}`,
    `\n1. Recap of what's done\n${or(bullets(done))}`,
    `\n2. Open questions\n${or(bullets(by('question')))}`,
    `\n3. Risks & blockers\n${or(bullets([...by('risk'), ...by('task').filter(t => t.status === 'blocked' || isOverdue(t.due))]))}`,
    `\n4. Next steps & dates\n${or(bullets(by('task').slice(0, 6), t => t.title + (t.due ? ` — ${fmtDue(t.due)}` : '')))}`,
  ].join('\n');
}

/** Built-in assistant (no Gemini): handles common commands, otherwise searches the record. */
function localAsk(p, question, ctx) {
  const q = expand(question).toLowerCase();
  const active = p.items.filter(isActive);
  const by = t => active.filter(i => i.type === t);
  const tasks = by('task');

  // "create tasks for all the risks / questions / requirements"
  if (/\b(create|make|add|turn|generate|convert|plan)\b/.test(q) && /\btasks?\b/.test(q)) {
    const types = ['risk', 'question', 'requirement', 'decision'].filter(t => new RegExp(`\\b${t}s?\\b`).test(q));
    if (/no task|without (a )?task|missing/.test(q) && !types.length) types.push('requirement');
    if (types.length) {
      const src = types.flatMap(by).filter(i => !(i.type === 'requirement' && i.scope === 'out'));
      const ops = src.filter(i => !hasTaskFor(p, i.title)).map(i => ({
        msg: i.sourceMsg || '', op: 'create', type: 'task', title: TASK_FROM[i.type](i.title),
        assignee: i.type === 'question' ? 'client' : 'owner', priority: i.type === 'risk' ? 'high' : 'normal',
        reason: `From ${TYPES[i.type].label.toLowerCase()} “${i.title}”`,
      }));
      const what = types.map(t => TYPES[t].plural.toLowerCase()).join(' and ');
      return {
        answer: ops.length
          ? `I've proposed task${ops.length > 1 ? 's' : ''} for the open ${what}. Review them below — nothing is created until you accept.`
          : `Every open item in ${what} already has a matching task.`,
        refs: src.map(i => i.id), ops,
      };
    }
  }

  // "mark the menu task done" / "cancel the newsletter task"
  const verb = q.match(/\b(mark|set|close|complete|finish|cancel|drop)\b/);
  const state = q.match(/\b(done|completed?|finished|cancel(?:led)?|drop(?:ped)?)\b/);
  if (verb && state) {
    const cancel = /cancel|drop/.test(state[1]);
    const words = q.replace(/\b(mark|set|close|complete|finish|cancel|drop|the|task|as|done|completed|finished|cancelled|dropped|please|it)\b/g, ' ');
    let best = null, score = 0;
    for (const t of tasks) { const o = overlap(words, t.title); if (o.inter && o.score > score) { best = t; score = o.score; } }
    if (best) {
      return {
        answer: `I've proposed marking “${best.title}” as ${cancel ? 'cancelled' : 'done'}. Accept it below.`,
        refs: [best.id], ops: [{ msg: '', op: 'status', targetId: best.id, status: cancel ? 'cancelled' : 'done', reason: 'Requested in the assistant' }],
      };
    }
  }

  // drafts
  if (/\b(draft|write|compose|prepare)\b/.test(q)) {
    if (/\b(agenda|call|meeting)\b/.test(q)) return { answer: 'Here is an agenda built from the open items.', refs: [], draft: agendaDraft(p) };
    if (/\b(reply|respond|answer)\b/.test(q)) {
      const last = [...p.messages].reverse().find(m => m.from === 'client' && m.text);
      const got = last ? p.items.filter(i => i.type !== 'sensitive' && i.type !== 'file' && (i.sourceMsg === last.id || i.history.some(h => h.msg === last.id))) : [];
      return {
        answer: last ? 'Draft reply to the client’s last message, confirming what was recorded from it.' : 'There is no client message to reply to yet.',
        refs: last ? [last.id] : [],
        draft: last ? `Thanks ${firstName(ctx.clientName)}! Noted:\n${bullets(got) || '• your message'}\n\nI'll get on it and keep you posted.` : '',
      };
    }
    return { answer: 'Here is a progress update you can send.', refs: [], draft: progressDraft(p, ctx) };
  }

  // status questions
  if (/\b(overdue|late|waiting|blocked|behind|stuck)\b/.test(q)) {
    const over = tasks.filter(t => isOverdue(t.due)), wait = tasks.filter(t => t.assignee === 'client'), blocked = tasks.filter(t => t.status === 'blocked');
    const parts = [
      over.length && `Overdue:\n${bullets(over, t => `${t.title} (was due ${fmtDue(t.due)})`)}`,
      wait.length && `Waiting on ${ctx.clientName}:\n${bullets(wait)}`,
      blocked.length && `Blocked:\n${bullets(blocked)}`,
    ].filter(Boolean);
    return { answer: parts.join('\n\n') || 'Nothing is overdue, blocked or waiting on the client.', refs: [...over, ...wait, ...blocked].map(i => i.id) };
  }
  if (/\b(changed|change|recent|lately|this week|last week)\b/.test(q)) {
    const since = Date.now() - 7 * 86400000;
    const ch = p.items.flatMap(i => i.history.filter(h => h.ts > since).map(h => ({ i, h }))).sort((a, b) => b.h.ts - a.h.ts).slice(0, 12);
    const what = h => (h.action === 'created' ? 'recorded' : h.action === 'status' ? `→ ${h.to.replace('_', ' ')}` : h.action === 'edit' ? `${h.field} changed` : 'note added');
    if (ch.length) return { answer: 'In the last 7 days:\n' + ch.map(({ i, h }) => `• ${TYPES[i.type].label} “${i.title}” ${what(h)}`).join('\n'), refs: [...new Set(ch.map(c => c.i.id))] };
  }

  const hits = [
    ...p.items.map(i => ({ id: i.id, text: `${TYPES[i.type].label}: ${i.title} (${i.status.replace('_', ' ')})`, s: overlap(q, i.title + ' ' + i.detail).inter })),
    ...p.messages.map(m => ({ id: m.id, text: `“${(m.text || '').slice(0, 140)}”`, s: overlap(q, expand(m.text || '')).inter })),
  ].filter(h => h.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
  return hits.length
    ? { answer: 'Closest matches in the project record (add a Gemini key for full answers):\n' + hits.map(h => '• ' + h.text).join('\n'), refs: hits.map(h => h.id) }
    : { answer: 'Nothing in this project matches that yet. With a Gemini key I can answer open-ended questions too.', refs: [] };
}

export async function askProject({ state, project: p, mutate, toast, question }) {
  const ctx = peopleOf(state, p);
  let res, engine = 'rules';
  if (geminiOn(state.settings)) {
    try { res = await gemini.ask(state.settings, p, ctx, question, p.asks); engine = 'gemini'; }
    catch (e) { toast?.(`Gemini: ${e.message}. Used the built-in assistant instead.`, 'error'); }
  }
  if (!res) res = localAsk(p, question, ctx);
  const ids = new Set([...p.items.map(i => i.id), ...p.messages.map(m => m.id)]);
  const secrets = secretValues(p);
  const entry = {
    id: uid('q'), ts: now(), question, engine,
    answer: maskText(String(res.answer || ''), secrets), refs: (res.refs || []).filter(r => ids.has(r)),
    draft: maskText(String(res.draft || ''), secrets), suggestionIds: [],
  };
  const ops = Array.isArray(res.ops) ? res.ops : [];
  const fresh = prepareSuggestions(p, ops, engine, { askId: entry.id });
  entry.suggestionIds = fresh.map(s => s.id);
  const skipped = ops.length - fresh.length;
  if (skipped > 0) {
    entry.answer += fresh.length
      ? `\n\n(${skipped} of them already exist or are already waiting for review, so I left those out.)`
      : `\n\nThose are already recorded or already waiting for your review in Suggestions — nothing new to add.`;
  }
  mutate(p.id, q => {
    q.asks.push(entry);
    fresh.forEach(s => q.suggestions.push(s));
    log(q, 'owner', 'ask', entry.id, { question, proposed: fresh.length });
  });
  return entry;
}
