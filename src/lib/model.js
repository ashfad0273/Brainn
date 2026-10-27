// The project record. One growing JSON per project:
//   messages     – raw conversation (append-only)
//   items        – structured records (append-only; only status/fields change, every change kept in history)
//   suggestions  – what the brain proposed (kept forever as pending / accepted / ignored)
//   summaries    – every generated project memory, newest last
//   asks         – questions asked to the brain and its answers
//   log          – append-only event log of everything that happened
//   members      – people invited to the project (client, developer, designer…), each with their own link + PIN
// Nothing is ever removed from the record. Deleting an item created by mistake leaves a tombstone
// (deleted: true) that hides it everywhere and wins when tabs merge; its trail stays in the JSON.

import { uid, now, norm, secureDigits, overlap, hashId } from './util';
import { mergeProject, union, newer, byKey } from './merge';
import { TYPES, SENSITIVE_CATS, REPLACED_STATUS, SOLVED_STATUS, isActive, DEFAULT_PERMS, MEMBER_ROLES, PROJECT_STATUS } from './meta';

export const defaultSettings = () => ({
  ownerName: 'You', workspaceName: 'My workspace', apiKey: '', model: 'gemini-3.5-flash-lite',
  useGemini: true, autoAnalyze: true, settingsAt: 0,
  // provider: 'rules' | 'cloudflare' | 'gemini' ('' = derive from the Gemini key, for older workspaces)
  provider: '', workerUrl: '', workerToken: '', cfModel: '',
  // organization (Settings → Organization) and message templates (#shortcut in the composer)
  org: { name: '', logo: '', tz: '', workStart: '09:00', workEnd: '18:00', color: '#0ea5e9' },
  templates: [],
});

export function log(p, actor, action, ref = null, data = null) {
  p.log.push({ id: uid('e'), ts: now(), actor, action, ref, data });
}

export function newProject({ id, name, client = '', description = '', color = '#0ea5e9', spaceId = null, cover = null, avatar = null, deadline = '', status = 'in_progress' }) {
  const t = now();
  const p = {
    id: id || uid('p'), name, client, description, color, spaceId, cover, avatar, archived: false, createdAt: t, metaAt: t,
    deadline, status: PROJECT_STATUS[status] ? status : 'in_progress', progressOverride: null, fileFolders: [],
    members: [], messages: [], items: [], suggestions: [], summaries: [], asks: [], log: [],
  };
  log(p, 'owner', 'project.create', null, { name });
  return p;
}

export function updateMeta(p, actor, patch, action = 'project.update') {
  Object.assign(p, patch);
  p.metaAt = now();
  log(p, actor, action, null, patch);
}

/* ---------------- messages ---------------- */

/** from = 'owner' | 'client' (anyone invited); memberId says which invited member wrote it. */
export function addMessage(p, { from, memberId = null, text = '', attachments = [], voice = null, replyTo = null }) {
  const m = {
    id: uid('m'), from, ...(from !== 'owner' && memberId ? { memberId } : {}),
    text, ts: now(), attachments, voice,
    replyTo: replyTo && replyTo.id ? { id: replyTo.id, name: replyTo.name || '', text: (replyTo.text || '').slice(0, 180) } : null,
    analyzed: !text.trim(),
  };
  p.messages.push(m);
  const actor = m.memberId || from;
  log(p, actor, 'message.add', m.id, attachments.length ? { files: attachments.length } : null);
  // Uploaded files are facts, not guesses: record them straight away (category can be changed later).
  for (const a of attachments) {
    addItem(p, actor, {
      type: 'file', title: a.name, category: a.category, kind: a.kind === 'voice' ? 'voice' : 'upload',
      file: { name: a.name, size: a.size, mime: a.mime, attachmentId: a.id }, sourceMsg: m.id, via: 'upload',
    });
  }
  return m;
}

/* ---------------- items ---------------- */

export function addItem(p, actor, d) {
  const t = now(), meta = TYPES[d.type];
  const it = {
    id: d.id || uid(d.type.slice(0, 2) + '_'), type: d.type,
    title: (d.title || '').trim() || meta.label, detail: d.detail || '', value: d.value || '',
    category: d.category || '', status: meta.statuses.includes(d.status) ? d.status : meta.initial,
    priority: d.priority || 'normal', due: d.due || '', assignee: d.assignee || '',
    scope: d.type === 'requirement' ? (d.scope === 'out' ? 'out' : 'in') : '',
    kind: d.kind || '', file: d.file || null, sourceMsg: d.sourceMsg || null,
    ...(d.sourceSpan ? { sourceSpan: d.sourceSpan } : {}),
    ...(d.sourceQuote ? { sourceQuote: d.sourceQuote } : {}),
    ...(d.sourceAttachment ? { sourceAttachment: d.sourceAttachment } : {}),
    createdAt: t, createdBy: actor, updatedAt: t, via: d.via || 'manual',
    replaces: d.replaces || null, supersededBy: null,
    history: [{ ts: t, by: actor, action: 'created', msg: d.sourceMsg || null, note: d.via === 'assistant' ? 'Proposed by the project assistant, approved by owner' : d.via && !['manual', 'upload'].includes(d.via) ? `Accepted from ${d.via === 'gemini' ? 'Gemini' : d.via === 'cloudflare' ? 'Cloudflare AI' : 'built-in rules'} suggestion` : '' }],
    notes: [],
    versions: d.type === 'requirement' ? [{ ts: t, by: actor, title: (d.title || '').trim(), detail: d.detail || '', msg: d.sourceMsg || null }] : [],
  };
  const dup = p.items.find(i => i.id === it.id);
  if (dup) return dup; // the same suggestion accepted twice (double click, or in two tabs)
  p.items.push(it);
  log(p, actor, 'item.create', it.id, { type: it.type, title: it.title });
  return it;
}

/** Items that are not deleted. Views, AI context and counts use these. */
export const liveItems = p => p.items.filter(i => !i.deleted);
/** The project as views and the AI see it: no deleted records, no hidden messages or suggestions about them. */
export function liveView(p) {
  const goneMsgs = p.messages.some(m => m.deleted);
  if (!goneMsgs && !p.items.some(i => i.deleted)) return p;
  const hidden = new Set(p.messages.filter(m => m.deleted).map(m => m.id));
  return {
    ...p, items: liveItems(p),
    ...(goneMsgs ? { messages: p.messages.filter(m => !m.deleted), suggestions: p.suggestions.filter(s => !hidden.has(s.msg)) } : {}),
  };
}

/* ---------------- project status & progress ---------------- */

/** Share of the work done: tasks done + requirements delivered, out of everything not cancelled/dropped. */
export function autoProgress(p) {
  const its = liveItems(p);
  const tasks = its.filter(i => i.type === 'task' && i.status !== 'cancelled');
  const reqs = its.filter(i => i.type === 'requirement' && i.status !== 'dropped');
  const total = tasks.length + reqs.length;
  if (!total) return 0;
  const done = tasks.filter(i => i.status === 'done').length + reqs.filter(i => i.status === 'delivered').length;
  return Math.round((done / total) * 100);
}
/** → { value, auto, manual } — a manual override wins; a completed project is always 100. */
export function projectProgress(p) {
  const auto = autoProgress(p);
  if (p.status === 'completed') return { value: 100, auto, manual: false };
  const manual = Number.isFinite(p.progressOverride) && p.progressOverride !== null;
  return { value: manual ? p.progressOverride : auto, auto, manual };
}
/** Days until the deadline (negative = overdue), or null without one. */
export function daysLeft(p) {
  if (!p.deadline) return null;
  const [y, m, d] = p.deadline.split('-').map(Number);
  const end = new Date(y, m - 1, d), today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end - today) / 86400000);
}
export function timeLeftLabel(p) {
  if (p.status === 'completed') return 'Completed';
  if (p.status === 'cancelled') return 'Cancelled';
  const n = daysLeft(p);
  if (n === null) return 'No deadline';
  if (n === 0) return 'Due today';
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} overdue`;
  if (n < 14) return `${n} day${n === 1 ? '' : 's'} left`;
  const w = Math.round(n / 7);
  return n < 60 ? `${w} weeks left` : `${Math.round(n / 30)} months left`;
}

/** Real delete for a record created by mistake (different from cancelling it). Leaves a tombstone. */
export function deleteItem(p, actor, id, reason = '') {
  const it = p.items.find(i => i.id === id);
  if (!it || it.deleted) return;
  const t = now();
  it.history.push({ ts: t, by: actor, action: 'deleted', note: reason });
  Object.assign(it, { deleted: true, deletedAt: t, deletedBy: actor, updatedAt: t });
  log(p, actor, 'item.delete', id, { type: it.type, title: it.title, reason });
}

export function setStatus(p, actor, id, status, { msg = null, note = '' } = {}) {
  const it = p.items.find(i => i.id === id);
  if (!it || it.deleted || it.status === status || !TYPES[it.type].statuses.includes(status)) return;
  const t = now();
  it.history.push({ ts: t, by: actor, action: 'status', from: it.status, to: status, msg, note });
  log(p, actor, 'item.status', id, { from: it.status, to: status });
  it.status = status;
  it.updatedAt = t;
}

const EDITABLE = ['title', 'detail', 'value', 'category', 'priority', 'due', 'assignee', 'scope', 'folder'];
export function editItem(p, actor, id, patch, { msg = null, note = '' } = {}) {
  const it = p.items.find(i => i.id === id);
  if (!it || it.deleted) return;
  const t = now(), changed = [];
  for (const k of EDITABLE) {
    if (!(k in patch) || patch[k] === undefined || patch[k] === it[k]) continue;
    it.history.push({ ts: t, by: actor, action: 'edit', field: k, from: it[k], to: patch[k], msg, note });
    it[k] = patch[k];
    changed.push(k);
  }
  if (!changed.length) return;
  if (it.type === 'requirement' && (changed.includes('title') || changed.includes('detail'))) {
    it.versions.push({ ts: t, by: actor, title: it.title, detail: it.detail, msg, note });
  }
  it.updatedAt = t;
  log(p, actor, 'item.edit', id, { fields: changed });
}

export function addNote(p, actor, id, text, { msg = null } = {}) {
  const it = p.items.find(i => i.id === id);
  if (!it || it.deleted || !text.trim()) return;
  const t = now();
  it.notes.push({ id: uid('n'), ts: t, by: actor, text: text.trim(), msg });
  it.history.push({ ts: t, by: actor, action: 'note', msg, note: text.trim() });
  it.updatedAt = t;
  log(p, actor, 'item.note', id);
}

/** What the AI read in an uploaded file (kept on the file record; re-reading adds to its history). */
export function recordReading(p, actor, itemId, reading) {
  const it = p.items.find(i => i.id === itemId);
  if (!it || it.deleted) return;
  const t = now();
  it.reading = { ts: t, ...reading };
  it.history.push({ ts: t, by: actor, action: 'read', note: `Read by ${reading.engine === 'gemini' ? 'Gemini' : 'Cloudflare AI'}${reading.vision ? ' (with the image)' : ''}` });
  it.updatedAt = t;
  log(p, actor, 'file.read', itemId, { engine: reading.engine, suggestions: reading.suggestions || 0 });
}

/* ---------------- source passages ---------------- */

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Where `quote` sits inside `text` → {start, end}, tolerant of case, spacing and a trimmed tail. */
export function findSpan(text, quote) {
  if (!text || !quote) return null;
  const q = String(quote).trim().replace(/^["“'‘]+|["”'’]+$/g, '').replace(/…$/, '').trim();
  if (q.length < 2) return null;
  let i = text.indexOf(q);
  if (i < 0) i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i >= 0) return { start: i, end: i + q.length };
  const words = q.split(/\s+/).filter(Boolean).map(esc);
  for (let n = words.length; n >= Math.min(3, words.length); n--) {
    const m = new RegExp(words.slice(0, n).join('[\\s,.;:!?-]+'), 'i').exec(text);
    if (m) return { start: m.index, end: m.index + m[0].length };
  }
  return null;
}

/* ---------------- suggestions ---------------- */

const TYPE_ALIAS = {
  task: 'task', todo: 'task', action: 'task', 'action item': 'task',
  requirement: 'requirement', req: 'requirement', requirements: 'requirement', preference: 'requirement', constraint: 'requirement',
  decision: 'decision', agreement: 'decision',
  sensitive: 'sensitive', cred: 'sensitive', credential: 'sensitive', credentials: 'sensitive', password: 'sensitive',
  secret: 'sensitive', info: 'sensitive', contact: 'sensitive', financial: 'sensitive', personal: 'sensitive',
  question: 'question', risk: 'risk', file: 'file', link: 'file', url: 'file',
};
const OP_ALIAS = { create: 'create', new: 'create', add: 'create', update: 'update', change: 'update', edit: 'update', status: 'status', done: 'status', complete: 'status', note: 'note', comment: 'note' };
const GENERIC_SOLVED = ['done', 'completed', 'complete', 'solved', 'resolved', 'finished', 'closed_done'];

/** A value as written, minus wrapping quotes, trailing punctuation and extra spaces. */
export const cleanValue = v => String(v ?? '').normalize('NFKC').trim()
  .replace(/^["'`“”‘’«<]+/, '').replace(/["'`“”‘’»>]+$/, '').replace(/[.,;:!?)\]]+$/, '').replace(/\s+/g, ' ').trim();
/** Comparison key for a value: URLs, emails, phone numbers and amounts compare loosely; passwords exactly. */
export function valueKey(v) {
  const s = cleanValue(v);
  if (!s) return '';
  if (/^(https?:\/\/|www\.)/i.test(s)) return 'u:' + s.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(s)) return 'e:' + s.toLowerCase();
  if (/^\+?[\d\s().-]{8,}$/.test(s) && s.replace(/\D/g, '').length >= 8) return 'n:' + s.replace(/\D/g, '');
  if (/^(?:[$€£৳₹]|usd|eur|gbp|bdt|tk|inr|rs\.?)?\s?\d[\d,.\s]*\s?(?:k|m|usd|eur|gbp|dollars|euros|pounds|bdt|taka|rupees)?$/i.test(s)) return 'm:' + s.replace(/[\s,]/g, '').toLowerCase();
  return 'v:' + s;
}
const keyOf = x => [x.op, x.type, x.targetId || '', norm(x.title), valueKey(x.value), x.status || ''].join('|');
const PLACEHOLDER = /\[SECRET_\d+\]/;

/** Index of what a project already has or was already offered, so the same thing is never proposed twice. */
function knownIndex(p, askId) {
  // An explicit request to the assistant may re-propose something ignored earlier.
  const sugg = p.suggestions.filter(s => !askId || s.state !== 'ignored');
  const keys = new Set(sugg.map(keyOf));
  p.items.forEach(i => keys.add(keyOf({ op: 'create', type: i.type, title: i.title, value: i.value })));
  const values = new Set([
    ...p.items.filter(i => i.type === 'sensitive' || i.type === 'file').flatMap(i => [i.value, ...i.history.filter(h => h.field === 'value').map(h => h.from)]),
    ...sugg.filter(s => s.op === 'create' && (s.type === 'sensitive' || s.type === 'file')).map(s => s.value),
  ].map(valueKey).filter(Boolean));
  const titles = [
    ...p.items.filter(i => !i.deleted).map(i => ({ type: i.type, title: i.title, msg: i.sourceMsg })),
    ...sugg.filter(s => s.op === 'create' && s.state !== 'ignored').map(s => ({ type: s.type, title: s.title, msg: s.msg })),
  ];
  return { keys, values, titles };
}
/** Near-identical wording of the same kind of record (e.g. rules and AI both proposing the task). */
function similarTitle(index, s) {
  if (s.op !== 'create' || s.type === 'sensitive' || s.type === 'file') return false;
  return index.titles.some(x => {
    if (x.type !== s.type) return false;
    const o = overlap(s.title, x.title);
    return x.msg && x.msg === s.msg ? o.inter >= 2 && o.score >= 0.7 : o.inter >= 3 && o.score >= 0.9;
  });
}
function isKnown(index, s) {
  if (index.keys.has(keyOf(s))) return true;
  if (s.op === 'create' && (s.type === 'sensitive' || s.type === 'file') && s.value && index.values.has(valueKey(s.value))) return true;
  return similarTitle(index, s);
}
function remember(index, s) {
  index.keys.add(keyOf(s));
  if (s.value && s.op === 'create') index.values.add(valueKey(s.value));
  if (s.op === 'create') index.titles.push({ type: s.type, title: s.title, msg: s.msg });
}

/**
 * Validate raw operations (from an AI provider or the built-in rules) and turn the new ones
 * into pending suggestions. Anything already recorded, already suggested (even if ignored)
 * or pointing at unknown messages/records is dropped. Values are compared after normalising.
 * Suggestion ids are derived from their content, so two tabs proposing the same thing merge into one.
 */
export function prepareSuggestions(p, ops, engine, { askId = null, attachment = null } = {}) {
  const index = knownIndex(p, askId);
  const msgs = new Map(p.messages.map(m => [m.id, m]));
  const members = new Set((p.members || []).filter(m => !m.revokedAt).map(m => m.id));
  const live = p.items.filter(i => !i.deleted);
  const out = [], t = now();

  for (const raw of Array.isArray(ops) ? ops : []) {
    if (!raw || typeof raw !== 'object') continue;
    const msg = msgs.has(raw.msg) ? raw.msg : null;
    if (!msg && !askId) continue; // chat analysis must point at a real message
    const rawType = String(raw.type || '').toLowerCase();
    let op = OP_ALIAS[String(raw.op || 'create').toLowerCase()] || 'create';
    let type = TYPE_ALIAS[rawType];
    let status = String(raw.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (rawType === 'done') { op = 'status'; status = status || 'done'; }

    const target = raw.targetId ? live.find(i => i.id === raw.targetId) : null;
    if (op !== 'create') { if (!target) continue; type = target.type; }
    if (!type || !TYPES[type]) continue;

    if (op === 'status') {
      if (GENERIC_SOLVED.includes(status) && !TYPES[type].statuses.includes(status)) status = SOLVED_STATUS[type];
      if (status === 'cancelled' && type !== 'task') status = type === 'requirement' ? 'dropped' : REPLACED_STATUS[type];
      if (!TYPES[type].statuses.includes(status) || target.status === status) continue;
    } else status = '';

    let category = String(raw.category || '').toLowerCase();
    if (type === 'sensitive' && !SENSITIVE_CATS[category]) category = /pass|pin|key|token|login|user|cred/.test(rawType + category + raw.title) ? 'credential' : 'confidential';
    if (type !== 'sensitive') category = String(raw.category || '');

    const assignee = String(raw.assignee || '');
    const s = {
      ts: t, updatedAt: t, msg, askId, op, type, targetId: target?.id || null,
      title: String(raw.title || '').replace(/\*\*|__|~~|`/g, '').trim().slice(0, 200), detail: String(raw.detail || '').slice(0, 2000),
      value: cleanValue(raw.value), category, status,
      priority: ['low', 'normal', 'high'].includes(raw.priority) ? raw.priority : 'normal',
      due: /^\d{4}-\d{2}-\d{2}$/.test(raw.due || '') ? raw.due : '',
      assignee: ['owner', 'client'].includes(assignee) || members.has(assignee) ? assignee : '',
      scope: type === 'requirement' ? (raw.scope === 'out' ? 'out' : 'in') : '',
      kind: type === 'file' ? 'link' : '',
      replaces: raw.replaces && live.some(i => i.id === raw.replaces && i.type === type) ? raw.replaces : null,
      reason: String(raw.reason || '').slice(0, 300), engine, state: 'pending',
    };
    // the exact passage the record came from: a span of the chat message, or a quote from a file
    if (attachment) {
      s.attachmentId = attachment;
      if (raw.quote) s.quote = String(raw.quote).trim().slice(0, 400);
    } else if (msg && (raw.quoteRaw || raw.quote)) {
      const span = findSpan(msgs.get(msg).text, raw.quoteRaw || raw.quote);
      if (span) s.span = span;
    }
    if ((op === 'create' || op === 'note') && !s.title) continue;
    if (op === 'update' && !s.title && !s.due && !s.detail && !s.value) continue;
    if (op === 'create' && type === 'file' && !/^(https?:\/\/|www\.)/i.test(s.value)) continue; // uploads are recorded directly
    if (op === 'create' && type === 'sensitive' && (!s.value || PLACEHOLDER.test(s.value))) continue; // a secret the model couldn't restore
    if (isKnown(index, s)) continue;
    remember(index, s);
    s.id = 's_' + hashId(keyOf(s) + '|' + (askId || '') + '|' + (msg || '') + '|' + (attachment || ''));
    out.push(s);
  }
  return out;
}

/** Add prepared suggestions to the current record, re-checking against what arrived meanwhile (other runs, other tabs). */
export function addSuggestions(p, fresh) {
  const ids = new Set(p.suggestions.map(s => s.id));
  const added = [];
  const byAsk = {};
  for (const s of fresh) (byAsk[s.askId || ''] ||= []).push(s);
  for (const [askId, list] of Object.entries(byAsk)) {
    const index = knownIndex(p, askId || null);
    for (const s of list) {
      if (ids.has(s.id) || isKnown(index, s)) continue;
      remember(index, s);
      ids.add(s.id);
      p.suggestions.push(s);
      added.push(s);
    }
  }
  return added;
}

/** Accept (optionally with edits), ignore or restore a suggestion. Suggestions themselves are never removed. */
export function resolveSuggestion(p, actor, sid, decision, edits = {}) {
  const s = p.suggestions.find(x => x.id === sid);
  if (!s) return;
  const t = now();
  if (decision === 'restore') {
    if (s.state !== 'ignored') return;
    s.state = 'pending'; s.updatedAt = t;
    log(p, actor, 'suggestion.restore', sid, { type: s.type, title: s.title });
    return;
  }
  if (s.state !== 'pending') return;
  if (decision === 'ignore') {
    s.state = 'ignored'; s.updatedAt = t;
    log(p, actor, 'suggestion.ignore', sid, { type: s.type, title: s.title });
    return;
  }
  const d = { ...s, ...edits };
  // Accepting a suggestion for something that was recorded meanwhile (another suggestion, another tab) just links to it.
  if (d.op === 'create' && (d.type === 'sensitive' || d.type === 'file') && d.value) {
    const k = valueKey(d.value);
    const same = p.items.find(i => !i.deleted && i.type === d.type && valueKey(i.value) === k);
    if (same) {
      Object.assign(s, { state: 'accepted', updatedAt: t, resultId: same.id, duplicateOf: same.id });
      log(p, actor, 'suggestion.accept', sid, { op: d.op, type: d.type, title: d.title, resultId: same.id, duplicate: true });
      return;
    }
  }
  const opts = { msg: s.msg, note: d.reason };
  let resultId = d.targetId;
  if (d.op === 'create') {
    const type = d.type;
    const it = addItem(p, actor, {
      id: type.slice(0, 2) + '_' + s.id.replace(/^s_/, ''),
      type, title: d.title, detail: d.detail, value: d.value, category: d.category, priority: d.priority, due: d.due,
      assignee: d.assignee, scope: d.scope, kind: d.kind, sourceMsg: s.msg, sourceSpan: s.span, sourceQuote: s.quote,
      sourceAttachment: s.attachmentId, via: s.askId ? 'assistant' : s.engine, replaces: d.replaces,
    });
    resultId = it.id;
    const old = d.replaces && p.items.find(i => i.id === d.replaces);
    if (old && isActive(old)) {
      setStatus(p, actor, old.id, REPLACED_STATUS[old.type], { msg: s.msg, note: `Replaced by “${it.title}”` });
      old.supersededBy = it.id;
    }
  } else if (d.op === 'update') {
    const patch = {};
    for (const k of ['title', 'detail', 'value', 'due', 'priority', 'scope', 'category', 'assignee']) if (d[k]) patch[k] = d[k];
    editItem(p, actor, d.targetId, patch, opts);
  } else if (d.op === 'status') {
    setStatus(p, actor, d.targetId, d.status, opts);
  } else if (d.op === 'note') {
    addNote(p, actor, d.targetId, d.title, { msg: s.msg });
  }
  Object.assign(s, { state: 'accepted', updatedAt: t, resultId, edited: Object.keys(edits).length > 0 });
  log(p, actor, 'suggestion.accept', sid, { op: d.op, type: d.type, title: d.title, resultId });
}

/** Every sensitive value known in a project (recorded or still suggested). */
export function secretValues(p) {
  return [...new Set([
    ...p.items.filter(i => i.type === 'sensitive').map(i => i.value),
    ...p.items.flatMap(i => (i.type === 'sensitive' ? i.history.filter(h => h.field === 'value').map(h => h.from) : [])),
    ...p.suggestions.filter(s => s.type === 'sensitive' && s.state !== 'ignored').map(s => s.value),
  ].filter(v => v && v.length >= 3))].sort((a, b) => b.length - a.length);
}
export const maskText = (text, values) => values.reduce((t, v) => t.split(v).join('••••••'), text || '');

/* ---------------- members (client, developer, designer…) ---------------- */

const touch = (m, t = now()) => { m.updatedAt = t; };
export const activeMembers = p => (p.members || []).filter(m => !m.revokedAt);
/** The signed-in invited person's own membership in a project. */
export const myMember = (p, user) => (user ? (p.members || []).find(m => m.userId === user.id && !m.revokedAt) || null : null);
/** Who sees AI suggestions and may act on them: the owner, and people given that permission. */
export const canReview = (role, me) => role === 'owner' || !!me?.perms?.suggestions;
/** The person shown as "the client": first active member with the client role, then any member. */
export const primaryClient = p => { const a = activeMembers(p); return a.find(m => m.role === 'client') || a[0] || null; };

/**
 * Display names for a project. Actors and assignees are 'owner', 'client' (older records / no member),
 * 'system', or a member id. msg(m) names a message's author; assignees() lists who work can go to.
 */
export function namesFor(p, ownerName = 'You') {
  const all = new Map((p.members || []).map(m => [m.id, m]));
  const client = primaryClient(p)?.name || p.client || 'Client';
  const of = a => (a === 'owner' ? ownerName : a === 'system' ? 'Project brain' : all.get(a)?.name || client);
  return {
    owner: ownerName, client, of,
    member: id => all.get(id) || null,
    msg: m => (m.from === 'owner' ? ownerName : all.get(m.memberId)?.name || client),
    assignees: current => {
      const list = [['owner', ownerName], ...activeMembers(p).map(m => [m.id, m.name])];
      if (list.length === 1 || current === 'client') list.push(['client', client]);
      if (current && !list.some(([k]) => k === current)) list.push([current, of(current)]);
      return list;
    },
  };
}

/** Gives a person's account (userId) access to the project. Their label from the People list becomes the role. */
export function addMember(p, actor, { id = uid('mb_'), userId = null, email = '', name, role = 'client', designation = '', perms = DEFAULT_PERMS }) {
  const t = now();
  const m = {
    id, userId, email, name: name.trim(), role: MEMBER_ROLES[role] ? role : 'other', designation: role === 'other' ? designation.trim() : '',
    perms: { ...perms }, createdAt: t, updatedAt: t, revokedAt: null,
  };
  p.members.push(m);
  p.metaAt = t;
  log(p, actor, 'member.add', m.id, { name: m.name, role: m.role, designation: m.designation });
  return m;
}
export function updateMember(p, actor, id, patch) {
  const m = p.members.find(x => x.id === id);
  if (!m || m.revokedAt) return;
  const next = {};
  if (patch.name?.trim()) next.name = patch.name.trim();
  if (patch.role && MEMBER_ROLES[patch.role]) next.role = patch.role;
  if ('designation' in patch) next.designation = (next.role || m.role) === 'other' ? String(patch.designation || '').trim() : '';
  if (patch.perms) next.perms = { ...patch.perms };
  if (patch.userId) next.userId = patch.userId;
  if ('email' in patch) next.email = String(patch.email || '');
  const changed = Object.keys(next).filter(k => JSON.stringify(next[k]) !== JSON.stringify(m[k]));
  if (!changed.length) return;
  changed.forEach(k => { m[k] = next[k]; });
  touch(m);
  p.metaAt = now();
  log(p, actor, changed.includes('perms') && changed.length === 1 ? 'member.perms' : 'member.update', id, { name: m.name, fields: changed });
}
export function revokeMember(p, actor, id) {
  const m = p.members.find(x => x.id === id);
  if (!m || m.revokedAt) return;
  const t = now();
  m.revokedAt = t;
  touch(m, t);
  p.metaAt = t;
  log(p, actor, 'member.revoke', id, { name: m.name });
}

/** Older records had one `invite` (+ `inviteHistory`). Each becomes a member, with an id derived from its token. */
function migrateInvites(p) {
  const fromInvite = (inv, ended) => ({
    id: 'mb_' + hashId(inv.token || inv.name + inv.createdAt), name: inv.name || 'Client', role: 'client', designation: '',
    perms: { ...DEFAULT_PERMS, ...(inv.perms || {}) }, pin: inv.pin, token: inv.token, createdAt: inv.createdAt || 0,
    updatedAt: ended || inv.createdAt || 0, revokedAt: ended || null,
  });
  return [...(p.inviteHistory || []).map(h => fromInvite(h, h.endedAt || 1)), ...(p.invite ? [fromInvite(p.invite, null)] : [])];
}

/* ---------------- normalise + merge (multi-tab sync) ---------------- */

export function normalizeProject(p) {
  const q = {
    description: '', spaceId: null, archived: false, metaAt: 0, cover: null, avatar: null,
    messages: [], items: [], suggestions: [], summaries: [], asks: [], log: [], ...p,
  };
  if (!PROJECT_STATUS[q.status]) q.status = q.archived ? 'completed' : 'in_progress';
  if (typeof q.deadline !== 'string') q.deadline = '';
  if (q.progressOverride === undefined) q.progressOverride = null;
  if (!Array.isArray(q.fileFolders)) q.fileFolders = [];
  if (!Array.isArray(q.members)) q.members = migrateInvites(q);
  delete q.invite;
  delete q.inviteHistory;
  return q;
}
export function normalizeState(s) {
  s = s || {};
  const d = defaultSettings(), settings = { ...d, ...(s.settings || {}) };
  settings.org = { ...d.org, ...(s.settings?.org || {}) };
  if (!Array.isArray(settings.templates)) settings.templates = [];
  return { version: 1, ...s, settings, spaces: s.spaces || [], projects: (s.projects || []).map(normalizeProject) };
}

export { mergeProject };
export function mergeState(a, b) {
  a = normalizeState(a); b = normalizeState(b);
  const settings = (b.settings.settingsAt || 0) > (a.settings.settingsAt || 0) ? b.settings : a.settings;
  const pm = new Map(a.projects.map(p => [p.id, p]));
  for (const p of b.projects) pm.set(p.id, pm.has(p.id) ? mergeProject(pm.get(p.id), p) : p);
  return { ...a, settings, spaces: union(a.spaces, b.spaces, newer, 'createdAt'), projects: [...pm.values()].sort(byKey('createdAt')) };
}

/* ---------------- demo duplicates ---------------- */

/** The two demo projects. Every browser used to build its own copy under these ids, dated from the day it was built. */
export const DEMO_IDS = ['p1jftgiae4', 'ph35pwtae5'];
const DAY = 86400000;

/**
 * Two demo copies merged into one project show every message twice, a few days apart. Keep the earliest copy
 * of each message, hide the others (a tombstone, so they stay hidden when copies merge again), point records
 * at the kept message and hide records / ignore suggestions that were made twice. Returns true if it changed p.
 */
export function hideDemoDuplicates(p) {
  if (!DEMO_IDS.includes(p.id)) return false;
  const groups = new Map();
  for (const m of p.messages) {
    if (m.deleted) continue;
    const k = [m.from, m.memberId || '', m.text, (m.attachments || []).map(a => a.name).join('|')].join('\u0001');
    (groups.get(k) || groups.set(k, []).get(k)).push(m);
  }
  const keep = new Map(); // hidden message id → kept message id
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.ts - b.ts);
    for (const m of list.slice(1)) {
      const off = (m.ts - list[0].ts) % DAY;
      if (off < 120000 || DAY - off < 120000) keep.set(m.id, list[0].id); // same time of day, whole days apart
    }
  }
  if (!keep.size) return false;
  const t = now();
  for (const m of p.messages) if (keep.has(m.id)) Object.assign(m, { deleted: true, deletedAt: t, deletedReason: 'duplicate demo message' });
  const seen = new Set(p.items.filter(i => !i.deleted && !keep.has(i.sourceMsg)).map(i => `${i.type}|${norm(i.title)}`));
  for (const it of p.items) {
    if (it.deleted || !keep.has(it.sourceMsg)) continue;
    const k = `${it.type}|${norm(it.title)}`;
    if (seen.has(k)) Object.assign(it, { deleted: true, deletedAt: t, deletedBy: 'system', updatedAt: t });
    else { it.sourceMsg = keep.get(it.sourceMsg); it.updatedAt = t; seen.add(k); }
  }
  const pending = new Set(p.suggestions.filter(s => !keep.has(s.msg)).map(s => `${s.op}|${s.type}|${norm(s.title)}|${s.status || ''}`));
  for (const s of p.suggestions) {
    if (!keep.has(s.msg)) continue;
    const k = `${s.op}|${s.type}|${norm(s.title)}|${s.status || ''}`;
    if (pending.has(k) && s.state === 'pending') Object.assign(s, { state: 'ignored', updatedAt: t, reason: 'Duplicate of a demo suggestion' });
    else { s.msg = keep.get(s.msg); s.updatedAt = t; pending.add(k); }
  }
  return true;
}
