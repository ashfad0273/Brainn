// Project Brain Server — Cloudflare Worker backed by D1 (SQLite), optional R2, and Workers AI.
//
// Owner endpoints (Authorization: Bearer <APP_TOKEN>):
//   POST /v1/generate               AI inference proxy (Llama 3.3 70B / 3.1 8B)
//   GET  /v1/sync                   Fetch the stored workspace
//   POST /v1/sync                   Push projects / spaces / settings (merged, never overwritten)
//   GET  /v1/blobs/:id              Download an attachment
//   PUT  /v1/blobs/:id              Upload an attachment
//
// Member portal (invite link + PIN):
//   GET  /v1/join/:token            Who the link is for (project name, member first name) — nothing else
//   POST /v1/join/:token/session    { pin } → { session, project, member, ownerName }; rate-limited
//   GET  /v1/join/:token/project    (Authorization: Member <session>) scoped project copy
//   POST /v1/join/:token/msg        (Member session) post a message as that member
//   GET  /v1/join/:token/blobs/:id  (Member session) download an attachment the member can see
//   PUT  /v1/join/:token/blobs/:id  (Member session) upload a new attachment
//
// Guards: allow-listed browser origins, owner bearer token, member PIN checked here (never sent to the
// browser) with a lockout after repeated misses, request size caps, allow-listed models.

import { mergeProject, withoutVault } from '../../src/lib/merge.js';

const enc = new TextEncoder();
const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

const PIN_MAX_FAILS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 12 * 60 * 60 * 1000;
const D1_BLOB_MAX = 1_900_000; // D1 rows top out at 2 MB

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function reply(body, status, cors, extraHeaders = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors, ...extraHeaders } });
}

/** Compare via SHA-256 digests so the check takes the same time whatever the input length. */
async function sameSecret(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(x, y);
}

/** Read the body, refusing anything over `max` bytes. */
async function readBody(req, max, as = 'text') {
  if (Number(req.headers.get('Content-Length') || 0) > max) throw new HttpError(413, `request larger than ${max} bytes`);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > max) throw new HttpError(413, `request larger than ${max} bytes`);
  if (as === 'bytes') return buf;
  const text = new TextDecoder().decode(buf);
  if (as === 'text') return text;
  try { return JSON.parse(text); } catch { throw new HttpError(400, 'body must be JSON'); }
}

/* ---------------- member sessions (HMAC-signed, no server state) ---------------- */

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode('member-session:' + env.APP_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
async function newSession(env, token, memberId) {
  const body = `${token}.${memberId}.${Date.now() + SESSION_MS}`;
  return `${body}.${await hmac(env, body)}`;
}
async function checkSession(env, req, token, memberId) {
  const s = (req.headers.get('Authorization') || '').replace(/^Member\s+/, '');
  const i = s.lastIndexOf('.');
  if (i < 0) return false;
  const body = s.slice(0, i), [t, m, exp] = body.split('.');
  if (t !== token || m !== memberId || !(Number(exp) > Date.now())) return false;
  return sameSecret(s.slice(i + 1), await hmac(env, body));
}

/* ---------------- projects in D1 ---------------- */

async function loadProject(env, id) {
  const row = await env.DB.prepare('SELECT data, updated_at FROM projects WHERE id = ?').bind(id).first();
  return row ? { p: JSON.parse(row.data), version: row.updated_at } : null;
}

/** Index of live invite tokens, so a join link is one lookup instead of a scan of every project. */
function memberIndex(env, p) {
  return [
    env.DB.prepare('DELETE FROM member_tokens WHERE project_id = ?').bind(p.id),
    ...(p.members || []).filter(m => m.token && !m.revokedAt)
      .map(m => env.DB.prepare('INSERT OR REPLACE INTO member_tokens (token, project_id, member_id) VALUES (?, ?, ?)').bind(m.token, p.id, m.id)),
  ];
}

/**
 * Merge `incoming` into the stored copy and save. Never overwrites: the stored record and the incoming
 * one are unioned (src/lib/merge.js). updated_at doubles as a version, so two writers racing (the owner
 * pushing while a member posts) retry instead of one silently dropping the other's changes.
 */
async function saveMerged(env, incoming) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const cur = await loadProject(env, incoming.id);
    const p = withoutVault(cur ? mergeProject(cur.p, incoming) : incoming);
    const data = JSON.stringify(p);
    if (enc.encode(data).length > D1_BLOB_MAX) throw new HttpError(413, `project ${p.id} is larger than the 2 MB a D1 row can hold`);
    const t = Date.now();
    const cols = [p.name || 'Untitled', p.client || '', p.spaceId || null, p.color || '#0ea5e9', p.archived ? 1 : 0, p.metaAt || t, data];
    let res;
    if (!cur) {
      res = await env.DB.prepare(`INSERT INTO projects (id, name, client, space_id, color, archived, meta_at, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`).bind(p.id, ...cols, p.createdAt || t, t).run();
    } else {
      const version = Math.max(t, cur.version + 1);
      res = await env.DB.prepare(`UPDATE projects SET name = ?, client = ?, space_id = ?, color = ?, archived = ?, meta_at = ?, data = ?, updated_at = ?
        WHERE id = ? AND updated_at = ?`).bind(...cols, version, p.id, cur.version).run();
    }
    if (res.meta.changes) {
      await env.DB.batch(memberIndex(env, p));
      return p;
    }
  }
  throw new HttpError(409, 'project is busy, try again');
}

/* ---------------- member portal ---------------- */

/** Scoped copy for an invited member: never the vault, suggestions, asks, notes, the log, or anyone's link/PIN. */
function memberCopy(p, me) {
  const perms = me.perms || {};
  const allowed = { task: perms.tasks, requirement: perms.requirements, decision: perms.decisions, file: perms.files };
  return {
    id: p.id, name: p.name, client: p.client, description: p.description, color: p.color,
    cover: p.cover, avatar: p.avatar, archived: !!p.archived, createdAt: p.createdAt, metaAt: p.metaAt,
    messages: (p.messages || []).map(m => ({ id: m.id, from: m.from, memberId: m.memberId, text: m.text, ts: m.ts, attachments: m.attachments || [], voice: m.voice, replyTo: m.replyTo })),
    items: (p.items || []).filter(i => !i.deleted && allowed[i.type])
      .map(i => ({ ...i, notes: [], history: (i.history || []).filter(h => h.action !== 'note' && h.action !== 'edit'), reading: undefined })),
    suggestions: [], asks: [], log: [],
    members: (p.members || []).map(m => ({ id: m.id, name: m.name, role: m.role, designation: m.designation, revokedAt: m.revokedAt, createdAt: m.createdAt })),
    summaries: perms.summary && Array.isArray(p.summaries) ? p.summaries.slice(-1) : [],
  };
}
const publicMember = m => ({ id: m.id, name: m.name, role: m.role, designation: m.designation, perms: m.perms || {} });

/** Attachment ids a member may download: the ones referenced in what they can already see. */
function visibleBlobs(view) {
  return new Set([
    ...view.messages.flatMap(m => m.attachments.map(a => a.id)),
    ...view.items.map(i => i.file?.attachmentId),
    view.cover?.id, view.avatar?.id,
  ].filter(Boolean));
}

async function ownerName(env) {
  const r = await env.DB.prepare("SELECT value FROM settings WHERE key = 'ownerName'").first();
  try { return r ? JSON.parse(r.value) : 'Owner'; } catch { return 'Owner'; }
}

const clip = (s, n) => String(s ?? '').slice(0, n);
const rid = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

/** A member's message, rebuilt from scratch on the server so a member can only ever add a message (and its file records). */
function memberMessage(p, me, body) {
  const t = Date.now();
  const attachments = (Array.isArray(body.attachments) ? body.attachments : []).slice(0, 20).map(a => ({
    id: clip(a.id, 40), name: clip(a.name, 200) || 'file', size: Number(a.size) || 0, mime: clip(a.mime, 100),
    kind: ['image', 'file', 'voice'].includes(a.kind) ? a.kind : 'file', category: clip(a.category, 60), stored: !!a.stored,
  })).filter(a => /^[\w-]+$/.test(a.id));
  const text = clip(body.text, 20000).trim();
  if (!text && !attachments.length) throw new HttpError(400, 'empty message');
  const voice = body.voice && Number.isFinite(Number(body.voice.duration)) ? { duration: Number(body.voice.duration) } : null;
  const id = /^m[\w-]{4,40}$/.test(body.id || '') && !(p.messages || []).some(m => m.id === body.id) ? body.id : rid('m');
  const replyTo = body.replyTo && typeof body.replyTo === 'object' && body.replyTo.id
    ? { id: clip(body.replyTo.id, 40), name: clip(body.replyTo.name, 60), text: clip(body.replyTo.text, 200) }
    : null;
  const m = { id, from: 'client', memberId: me.id, text, ts: t, attachments, voice, analyzed: !text, replyTo };
  // same records addMessage() in src/lib/model.js makes for uploads
  const items = attachments.map(a => ({
    id: rid('fi_'), type: 'file', title: a.name, detail: '', value: '', category: a.category, status: 'active', priority: 'normal',
    due: '', assignee: '', scope: '', kind: a.kind === 'voice' ? 'voice' : 'upload',
    file: { name: a.name, size: a.size, mime: a.mime, attachmentId: a.id }, sourceMsg: id,
    createdAt: t, createdBy: me.id, updatedAt: t, via: 'upload', replaces: null, supersededBy: null,
    history: [{ ts: t, by: me.id, action: 'created', msg: id, note: '' }], notes: [], versions: [],
  }));
  const log = [
    { id: rid('e'), ts: t, actor: me.id, action: 'message.add', ref: id, data: attachments.length ? { files: attachments.length } : null },
    ...items.map(i => ({ id: rid('e'), ts: t, actor: me.id, action: 'item.create', ref: i.id, data: { type: 'file', title: i.title } })),
  ];
  return { delta: { id: p.id, metaAt: 0, messages: [m], items, log }, message: m };
}

async function handleJoin(req, env, cors, path) {
  const [token, action, blobId] = path.slice('/v1/join/'.length).split('/').map(decodeURIComponent);
  if (!token) throw new HttpError(400, 'token required');

  const idx = await env.DB.prepare('SELECT project_id, member_id FROM member_tokens WHERE token = ?').bind(token).first();
  const cur = idx && await loadProject(env, idx.project_id);
  const me = cur && (cur.p.members || []).find(m => m.id === idx.member_id && m.token === token && !m.revokedAt);
  if (!me) throw new HttpError(404, 'invalid or revoked link');
  const p = cur.p;

  // Public: just enough to greet the person on the PIN screen.
  if (!action && req.method === 'GET') {
    return reply({ project: { name: p.name, color: p.color }, member: { name: (me.name || '').split(' ')[0] } }, 200, cors);
  }

  if (action === 'session' && req.method === 'POST') {
    const now = Date.now();
    const att = await env.DB.prepare('SELECT fails, locked_until FROM join_attempts WHERE token = ?').bind(token).first();
    if (att && att.locked_until > now) {
      const retryAfter = Math.ceil((att.locked_until - now) / 1000);
      return reply({ error: 'too many wrong PINs', retryAfter }, 429, cors, { 'Retry-After': String(retryAfter) });
    }
    const { pin } = await readBody(req, 1000, 'json');
    if (!(await sameSecret(String(pin || ''), String(me.pin || '')))) {
      const fails = (att?.fails || 0) + 1;
      const locked = fails >= PIN_MAX_FAILS;
      await env.DB.prepare('INSERT OR REPLACE INTO join_attempts (token, fails, locked_until) VALUES (?, ?, ?)')
        .bind(token, locked ? 0 : fails, locked ? now + PIN_LOCK_MS : 0).run();
      return reply({ error: 'wrong PIN', triesLeft: locked ? 0 : PIN_MAX_FAILS - fails }, locked ? 429 : 401, cors);
    }
    if (att) await env.DB.prepare('DELETE FROM join_attempts WHERE token = ?').bind(token).run();
    return reply({ session: await newSession(env, token, me.id), project: memberCopy(p, me), member: publicMember(me), ownerName: await ownerName(env) }, 200, cors);
  }

  if (!(await checkSession(env, req, token, me.id))) throw new HttpError(401, 'session expired');

  if (action === 'project' && req.method === 'GET') {
    return reply({ project: memberCopy(p, me), member: publicMember(me), ownerName: await ownerName(env) }, 200, cors);
  }

  if (action === 'msg' && req.method === 'POST') {
    const body = await readBody(req, Number(env.MAX_BODY_BYTES) || 200000, 'json');
    const { delta, message } = memberMessage(p, me, body || {});
    const saved = await saveMerged(env, delta);
    return reply({ ok: true, message, project: memberCopy(saved, me) }, 200, cors);
  }

  if (action === 'blobs' && blobId) {
    if (req.method === 'GET') {
      if (!visibleBlobs(memberCopy(p, me)).has(blobId)) throw new HttpError(404, 'blob not found');
      return getBlob(env, cors, blobId);
    }
    if (req.method === 'PUT') {
      if (!/^[\w-]+$/.test(blobId)) throw new HttpError(400, 'bad blob id');
      if (await blobExists(env, blobId)) throw new HttpError(409, 'blob already exists'); // members can add files, never replace one
      return putBlob(req, env, cors, blobId);
    }
  }
  throw new HttpError(405, 'method not allowed');
}

/* ---------------- attachments (R2 if bound, else D1) ---------------- */

async function blobExists(env, id) {
  if (env.BUCKET && await env.BUCKET.head(id)) return true;
  return !!(await env.DB.prepare('SELECT 1 FROM blobs WHERE id = ?').bind(id).first());
}

async function getBlob(env, cors, id) {
  const headers = new Headers(cors);
  if (env.BUCKET) {
    const obj = await env.BUCKET.get(id);
    if (obj) {
      headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
      if (obj.customMetadata?.enc === '1') headers.set('X-Encrypted', '1');
      return new Response(obj.body, { headers });
    }
  }
  const r = await env.DB.prepare('SELECT mime, data, enc FROM blobs WHERE id = ?').bind(id).first();
  if (!r || !r.data) throw new HttpError(404, 'blob not found');
  headers.set('Content-Type', r.mime || 'application/octet-stream');
  if (r.enc) headers.set('X-Encrypted', '1');
  const bytes = r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data);
  headers.set('Content-Length', String(bytes.byteLength));
  return new Response(bytes, { headers });
}

async function putBlob(req, env, cors, id) {
  const max = env.BUCKET ? (Number(env.MAX_BLOB_BYTES) || 25_000_000) : D1_BLOB_MAX;
  const mime = req.headers.get('X-Attachment-Mime') || 'application/octet-stream';
  const encFlag = req.headers.get('X-Attachment-Enc') === '1' ? 1 : 0;
  const buf = await readBody(req, max, 'bytes');
  if (env.BUCKET) await env.BUCKET.put(id, buf, { httpMetadata: { contentType: mime }, customMetadata: { enc: String(encFlag) } });
  else {
    await env.DB.prepare('INSERT OR REPLACE INTO blobs (id, mime, enc, data, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, mime, encFlag, buf, buf.byteLength, Date.now()).run();
  }
  return reply({ ok: true, id, size: buf.byteLength }, 200, cors);
}

/* ---------------- owner sync ---------------- */

async function handleSync(req, env, cors) {
  if (req.method === 'GET') {
    const [projRows, spaceRows, settingsRows] = await env.DB.batch([
      env.DB.prepare('SELECT data FROM projects ORDER BY created_at ASC'),
      env.DB.prepare('SELECT * FROM spaces'),
      env.DB.prepare('SELECT * FROM settings'),
    ]);
    const projects = projRows.results.map(r => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);
    const spaces = spaceRows.results.map(s => ({ id: s.id, name: s.name, createdAt: s.created_at, updatedAt: s.updated_at }));
    const settings = {};
    for (const s of settingsRows.results) { try { settings[s.key] = JSON.parse(s.value); } catch { settings[s.key] = s.value; } }
    return reply({ projects, spaces, settings, serverTime: Date.now() }, 200, cors);
  }

  if (req.method === 'POST') {
    const { projects = [], spaces = [], settings = null } = await readBody(req, Number(env.MAX_SYNC_BYTES) || 8_000_000, 'json');
    const now = Date.now();
    for (const p of projects) if (p?.id) await saveMerged(env, p);

    const statements = [];
    for (const sp of spaces) {
      if (!sp?.id) continue;
      statements.push(env.DB.prepare(`INSERT INTO spaces (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(id) DO UPDATE SET name = ?2, updated_at = ?4 WHERE ?4 >= spaces.updated_at`).bind(sp.id, sp.name, sp.createdAt || now, sp.updatedAt || now));
    }
    if (settings && typeof settings === 'object') {
      const at = Number(settings.settingsAt) || 0;
      for (const [k, v] of Object.entries(settings)) {
        if (k === 'apiKey' || k === 'workerToken') continue; // secrets never leave the owner's browser
        statements.push(env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
          ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3 WHERE ?3 >= settings.updated_at`).bind(k, JSON.stringify(v), at));
      }
    }
    if (statements.length) await env.DB.batch(statements);
    return reply({ ok: true, syncedProjects: projects.length, serverTime: now }, 200, cors);
  }
  throw new HttpError(405, 'method not allowed');
}

/* ---------------- AI ---------------- */

async function handleGenerate(req, env, cors) {
  if (req.method !== 'POST') throw new HttpError(405, 'use POST');
  const body = await readBody(req, Number(env.MAX_BODY_BYTES) || 200000, 'json');
  const { prompt, system, model, schema } = body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, 'prompt is required');

  const allowed = list(env.ALLOWED_MODELS);
  const useModel = model && allowed.includes(model) ? model : env.DEFAULT_MODEL;
  const temperature = Math.min(1, Math.max(0, Number(body.temperature ?? 0.2)));
  const max_tokens = Math.min(4096, Math.max(64, Number(body.maxTokens) || 2048));
  const messages = [...(typeof system === 'string' && system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];
  const base = { messages, temperature, max_tokens };

  try {
    if (schema && typeof schema === 'object') {
      try {
        const r = await env.AI.run(useModel, { ...base, response_format: { type: 'json_schema', json_schema: schema } });
        return reply({ model: useModel, output: r.response, jsonMode: true }, 200, cors);
      } catch { /* model refused JSON mode: fall back to plain text */ }
    }
    const r = await env.AI.run(useModel, base);
    return reply({ model: useModel, output: r.response, jsonMode: false }, 200, cors);
  } catch (e) {
    return reply({ error: `Workers AI: ${e?.message || e}` }, 502, cors);
  }
}

/* ---------------- router ---------------- */

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const okOrigin = list(env.ALLOWED_ORIGINS).includes(origin) || /^https:\/\/[a-z0-9_-]+\.project-brain-557\.pages\.dev$/i.test(origin);
    const cors = okOrigin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Attachment-Mime, X-Attachment-Enc',
      'Access-Control-Expose-Headers': 'X-Encrypted, Retry-After',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    } : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!okOrigin) return reply({ error: 'origin not allowed' }, 403, cors);
    if (!env.APP_TOKEN) return reply({ error: 'APP_TOKEN secret is not set on the Worker' }, 500, cors);

    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    try {
      if (path.startsWith('/v1/join/')) return await handleJoin(req, env, cors, path);

      if (!(await sameSecret(req.headers.get('Authorization') || '', `Bearer ${env.APP_TOKEN}`))) return reply({ error: 'unauthorized' }, 401, cors);
      if (path === '/v1/health') return reply({ status: 'ok', time: Date.now() }, 200, cors);
      if (path === '/v1/generate') return await handleGenerate(req, env, cors);
      if (path === '/v1/sync') return await handleSync(req, env, cors);
      if (path.startsWith('/v1/blobs/')) {
        const id = decodeURIComponent(path.slice('/v1/blobs/'.length));
        if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'bad blob id');
        if (req.method === 'GET') return await getBlob(env, cors, id);
        if (req.method === 'PUT') return await putBlob(req, env, cors, id);
        throw new HttpError(405, 'method not allowed');
      }
      return reply({ error: 'not found' }, 404, cors);
    } catch (e) {
      if (e instanceof HttpError) return reply({ error: e.message }, e.status, cors);
      return reply({ error: 'server error: ' + (e?.message || e) }, 500, cors);
    }
  },
};
