// The project record. One growing JSON per project:
//   messages     – raw conversation (append-only)
//   items        – structured records (append-only; only status/fields change, every change kept in history)
//   suggestions  – what the brain proposed (kept forever as pending / accepted / ignored)
//   summaries    – every generated project memory, newest last
//   asks         – questions asked to the brain and its answers
//   log          – append-only event log of everything that happened
// There is deliberately no delete operation anywhere in this file.

import { uid, now, norm, secureDigits } from './util';
import { TYPES, SENSITIVE_CATS, REPLACED_STATUS, SOLVED_STATUS, isActive, DEFAULT_PERMS } from './meta';

export const defaultSettings = () => ({
  ownerName: 'You', workspaceName: 'My workspace', apiKey: '', model: 'gemini-3.5-flash-lite',
  useGemini: true, autoAnalyze: true, settingsAt: 0,
});

export function log(p, actor, action, ref = null, data = null) {
  p.log.push({ id: uid('e'), ts: now(), actor, action, ref, data });
}

export function newProject({ name, client = '', description = '', color = '#0ea5e9', spaceId = null }) {
  const t = now();
  const p = {
    id: uid('p'), name, client, description, color, spaceId, archived: false, createdAt: t, metaAt: t,
    invite: null, inviteHistory: [], messages: [], items: [], suggestions: [], summaries: [], asks: [], log: [],
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

export function addMessage(p, { from, text = '', attachments = [], voice = null }) {
  const m = { id: uid('m'), from, text, ts: now(), attachments, voice, analyzed: !text.trim() };
  p.messages.push(m);
  log(p, from, 'message.add', m.id, attachments.length ? { files: attachments.length } : null);
  // Uploaded files are facts, not guesses: record them straight away (category can be changed later).
  for (const a of attachments) {
    addItem(p, from, {
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
    id: uid(d.type.slice(0, 2) + '_'), type: d.type,
    title: (d.title || '').trim() || meta.label, detail: d.detail || '', value: d.value || '',
    category: d.category || '', status: meta.statuses.includes(d.status) ? d.status : meta.initial,
    priority: d.priority || 'normal', due: d.due || '', assignee: d.assignee || '',
    scope: d.type === 'requirement' ? (d.scope === 'out' ? 'out' : 'in') : '',
    kind: d.kind || '', file: d.file || null, sourceMsg: d.sourceMsg || null,
    createdAt: t, createdBy: actor, updatedAt: t, via: d.via || 'manual',
    replaces: d.replaces || null, supersededBy: null,
    history: [{ ts: t, by: actor, action: 'created', msg: d.sourceMsg || null, note: d.via === 'assistant' ? 'Proposed by the project assistant, approved by owner' : d.via && !['manual', 'upload'].includes(d.via) ? `Accepted from ${d.via === 'gemini' ? 'Gemini' : 'built-in rules'} suggestion` : '' }],
    notes: [],
    versions: d.type === 'requirement' ? [{ ts: t, by: actor, title: (d.title || '').trim(), detail: d.detail || '', msg: d.sourceMsg || null }] : [],
  };
  p.items.push(it);
  log(p, actor, 'item.create', it.id, { type: it.type, title: it.title });
  return it;
}

export function setStatus(p, actor, id, status, { msg = null, note = '' } = {}) {
  const it = p.items.find(i => i.id === id);
  if (!it || it.status === status || !TYPES[it.type].statuses.includes(status)) return;
  const t = now();
  it.history.push({ ts: t, by: actor, action: 'status', from: it.status, to: status, msg, note });
  log(p, actor, 'item.status', id, { from: it.status, to: status });
  it.status = status;
  it.updatedAt = t;
}

const EDITABLE = ['title', 'detail', 'value', 'category', 'priority', 'due', 'assignee', 'scope'];
export function editItem(p, actor, id, patch, { msg = null, note = '' } = {}) {
  const it = p.items.find(i => i.id === id);
  if (!it) return;
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
  if (!it || !text.trim()) return;
  const t = now();
  it.notes.push({ id: uid('n'), ts: t, by: actor, text: text.trim(), msg });
  it.history.push({ ts: t, by: actor, action: 'note', msg, note: text.trim() });
  it.updatedAt = t;
  log(p, actor, 'item.note', id);
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

const keyOf = x => [x.op, x.type, x.targetId || '', norm(x.title), x.value || '', x.status || ''].join('|');

/**
 * Validate raw operations (from Gemini or the built-in rules) and turn the new ones
 * into pending suggestions. Anything already recorded, already suggested (even if ignored)
 * or pointing at unknown messages/records is dropped.
 */
export function prepareSuggestions(p, ops, engine, { askId = null } = {}) {
  // An explicit request to the assistant may re-propose something ignored earlier.
  const seen = new Set(p.suggestions.filter(s => !askId || s.state !== 'ignored').map(keyOf));
  p.items.forEach(i => seen.add(keyOf({ op: 'create', type: i.type, title: i.title, value: i.value })));
  const values = new Set(p.items.filter(i => i.type === 'sensitive' || i.type === 'file').map(i => i.value).filter(Boolean));
  const msgIds = new Set(p.messages.map(m => m.id));
  const out = [], t = now();

  for (const raw of Array.isArray(ops) ? ops : []) {
    if (!raw || typeof raw !== 'object') continue;
    const msg = msgIds.has(raw.msg) ? raw.msg : null;
    if (!msg && !askId) continue; // chat analysis must point at a real message
    const rawType = String(raw.type || '').toLowerCase();
    let op = OP_ALIAS[String(raw.op || 'create').toLowerCase()] || 'create';
    let type = TYPE_ALIAS[rawType];
    let status = String(raw.status || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (rawType === 'done') { op = 'status'; status = status || 'done'; }

    const target = raw.targetId ? p.items.find(i => i.id === raw.targetId) : null;
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

    const s = {
      id: uid('s'), ts: t, updatedAt: t, msg, askId, op, type, targetId: target?.id || null,
      title: String(raw.title || '').trim().slice(0, 200), detail: String(raw.detail || '').slice(0, 2000),
      value: String(raw.value ?? '').trim(), category, status,
      priority: ['low', 'normal', 'high'].includes(raw.priority) ? raw.priority : 'normal',
      due: /^\d{4}-\d{2}-\d{2}$/.test(raw.due || '') ? raw.due : '',
      assignee: ['owner', 'client'].includes(raw.assignee) ? raw.assignee : '',
      scope: type === 'requirement' ? (raw.scope === 'out' ? 'out' : 'in') : '',
      kind: type === 'file' ? 'link' : '',
      replaces: raw.replaces && p.items.some(i => i.id === raw.replaces && i.type === type) ? raw.replaces : null,
      reason: String(raw.reason || '').slice(0, 300), engine, state: 'pending',
    };
    if ((op === 'create' || op === 'note') && !s.title) continue;
    if (op === 'update' && !s.title && !s.due && !s.detail && !s.value) continue;
    if (op === 'create' && type === 'file' && !/^(https?:\/\/|www\.)/i.test(s.value)) continue; // uploads are recorded directly
    if (op === 'create' && (type === 'sensitive' || type === 'file') && s.value && values.has(s.value)) continue;
    const k = keyOf(s);
    if (seen.has(k)) continue;
    seen.add(k);
    if (s.value) values.add(s.value);
    out.push(s);
  }
  return out;
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
  const opts = { msg: s.msg, note: d.reason };
  let resultId = d.targetId;
  if (d.op === 'create') {
    const type = d.type;
    const it = addItem(p, actor, {
      type, title: d.title, detail: d.detail, value: d.value, category: d.category, priority: d.priority, due: d.due,
      assignee: d.assignee, scope: d.scope, kind: d.kind, sourceMsg: s.msg, via: s.askId ? 'assistant' : s.engine, replaces: d.replaces,
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

/* ---------------- client invites ---------------- */

export function createInvite(p, actor, { name, perms = DEFAULT_PERMS }) {
  if (p.invite) p.inviteHistory.push({ ...p.invite, endedAt: now(), reason: 'replaced' });
  p.invite = { name, perms, pin: secureDigits(4), token: uid() + uid(), createdAt: now() };
  p.metaAt = now();
  log(p, actor, 'invite.create', null, { name });
}
export function setInvitePerms(p, actor, perms) {
  if (!p.invite) return;
  p.invite = { ...p.invite, perms };
  p.metaAt = now();
  log(p, actor, 'invite.perms', null, perms);
}
export function revokeInvite(p, actor) {
  if (!p.invite) return;
  p.inviteHistory.push({ ...p.invite, endedAt: now(), reason: 'revoked' });
  log(p, actor, 'invite.revoke', null, { name: p.invite.name });
  p.invite = null;
  p.metaAt = now();
}

/* ---------------- normalise + merge (multi-tab sync) ---------------- */

export function normalizeProject(p) {
  return {
    description: '', spaceId: null, archived: false, metaAt: 0, invite: null, inviteHistory: [],
    messages: [], items: [], suggestions: [], summaries: [], asks: [], log: [], ...p,
  };
}
export function normalizeState(s) {
  s = s || {};
  return { version: 1, ...s, settings: { ...defaultSettings(), ...(s.settings || {}) }, spaces: s.spaces || [], projects: (s.projects || []).map(normalizeProject) };
}

const byKey = k => (a, b) => ((a[k] || 0) - (b[k] || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
function union(a, b, pick, sortKey) {
  const m = new Map(a.map(x => [x.id, x]));
  for (const y of b) { const x = m.get(y.id); m.set(y.id, x ? pick(x, y) : y); }
  return [...m.values()].sort(byKey(sortKey));
}
const newer = (x, y) => ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);
const first = x => x;
const META = ['name', 'client', 'description', 'color', 'spaceId', 'archived', 'invite', 'inviteHistory', 'metaAt'];

/** Because the record is append-only, two copies can always be merged without losing anything. */
export function mergeProject(a, b) {
  const src = (b.metaAt || 0) > (a.metaAt || 0) ? b : a;
  const out = { ...a };
  META.forEach(k => { out[k] = src[k]; });
  out.messages = union(a.messages, b.messages, (x, y) => (x.analyzed ? x : y), 'ts');
  out.items = union(a.items, b.items, newer, 'createdAt');
  out.suggestions = union(a.suggestions, b.suggestions, newer, 'ts');
  out.summaries = union(a.summaries, b.summaries, first, 'ts');
  out.asks = union(a.asks, b.asks, first, 'ts');
  out.log = union(a.log, b.log, first, 'ts');
  return out;
}
export function mergeState(a, b) {
  a = normalizeState(a); b = normalizeState(b);
  const settings = (b.settings.settingsAt || 0) > (a.settings.settingsAt || 0) ? b.settings : a.settings;
  const pm = new Map(a.projects.map(p => [p.id, p]));
  for (const p of b.projects) pm.set(p.id, pm.has(p.id) ? mergeProject(pm.get(p.id), p) : p);
  return { ...a, settings, spaces: union(a.spaces, b.spaces, newer, 'createdAt'), projects: [...pm.values()].sort(byKey('createdAt')) };
}
