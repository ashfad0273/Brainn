// Project Brain Server — Cloudflare Worker backed by D1 (SQLite), optional R2, Gemini and Workers AI.
//
// Accounts: one owner (created once with the APP_TOKEN as setup code) and the people the owner invites
// by email. Everyone signs in with email + password; requests carry "Authorization: Session <token>".
//
// Public:
//   GET  /v1/auth/status              { hasOwner, org }  (login page branding)
//   POST /v1/auth/setup               { setupCode, email, password, name, tz } → first (owner) account
//   POST /v1/auth/login               { email, password, tz } → { session, user }; rate-limited per email
//   GET  /v1/invites/:token           who the invite is for
//   POST /v1/invites/:token/accept    { name, password, tz } → { session, user }
// Signed in (anyone):
//   GET/PATCH /v1/auth/me             profile: name, time zone, working hours, password
//   POST /v1/ai                       Gemini / Workers AI with the server's keys (daily cap for members)
//   GET  /v1/unfurl?url=              link preview: title, image, description, can it be framed
//   GET/PUT/DELETE /v1/drafts/:pid    the unsent message in a project, per person (follows you across devices)
// Owner:
//   GET/POST /v1/sync                 the workspace (pushes are merged, never overwritten)
//   GET/PUT  /v1/blobs/:id            attachments
//   GET  /v1/people                   everyone invited
//   POST /v1/people/invite            { email, name, label, appUrl } → invite link, emailed by Cloudflare when set up
//   PATCH /v1/people/:id              label / name / time zone / disable
//   POST /v1/people/:id/reinvite      { appUrl } → fresh invite link
//   GET  /v1/ai/models                Gemini models the server key can use
//   GET/PUT /v1/admin/keys            the Gemini key, set from the app (stored encrypted, never sent back)
// Invited people:
//   GET  /v1/m/workspace              the projects they were given, scoped by their permissions
//   POST /v1/m/projects/:pid/msg      post a message
//   POST /v1/m/projects/:pid/apply    accept / edit / ignore suggestions (only with the "suggestions" permission)
//   GET/PUT /v1/m/blobs/:id           attachments they can see / new uploads

import { mergeProject, withoutVault } from '../../src/lib/merge.js';

const enc = new TextEncoder();
const list = s => (s || '').split(',').map(x => x.trim()).filter(Boolean);

const LOGIN_MAX_FAILS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const INVITE_MS = 7 * 24 * 60 * 60 * 1000;
const PBKDF2_ITER = 100000; // the most Workers allow
const D1_BLOB_MAX = 1_900_000; // D1 rows top out at 2 MB
const UNFURL_TTL = 7 * 24 * 60 * 60 * 1000;

class HttpError extends Error {
  constructor(status, message, extra = {}) { super(message); this.status = status; this.extra = extra; }
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
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'body must be JSON'); }
}

const clip = (s, n) => String(s ?? '').slice(0, n);
const rid = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64url = buf => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randToken = (n = 24) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const normEmail = e => String(e || '').trim().toLowerCase();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
const validTz = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; } };
const validHM = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- passwords & sessions ---------------- */

async function hashPassword(password, saltB64 = b64(crypto.getRandomValues(new Uint8Array(16)))) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromB64(saltB64), iterations: PBKDF2_ITER, hash: 'SHA-256' }, base, 256);
  return { hash: b64(bits), salt: saltB64 };
}
function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) throw new HttpError(400, 'Use a password of at least 8 characters');
  if (pw.length > 200) throw new HttpError(400, 'That password is too long');
}

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode('session:' + env.APP_TOKEN), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
/** user.epoch is bumped to sign someone out everywhere (disabling an account does that). */
async function newSession(env, user) {
  const body = `${user.id}.${user.epoch || 0}.${Date.now() + SESSION_MS}`;
  return `${body}.${await hmac(env, body)}`;
}
async function sessionUser(env, req) {
  const s = (req.headers.get('Authorization') || '').replace(/^Session\s+/, '');
  const i = s.lastIndexOf('.');
  if (i < 0) return null;
  const body = s.slice(0, i), [id, epoch, exp] = body.split('.');
  if (!(Number(exp) > Date.now()) || !(await sameSecret(s.slice(i + 1), await hmac(env, body)))) return null;
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!u || u.disabled || String(u.epoch) !== epoch || !u.pass_hash) return null;
  return u;
}

/** What the browser may know about a person. */
const publicUser = (u, withEmail = true) => ({
  id: u.id, ...(withEmail ? { email: u.email } : {}), name: u.name, role: u.role, label: u.label,
  tz: u.tz || '', workStart: u.work_start || '09:00', workEnd: u.work_end || '18:00',
  status: u.disabled ? 'disabled' : u.pass_hash ? 'active' : 'invited', createdAt: u.created_at,
});

/* ---------------- keys set from the app ---------------- */

// The owner sets the Gemini key in Settings → AI instead of with wrangler. It's stored in D1 encrypted with a
// key derived from APP_TOKEN, never returned to a browser, and wins over the GEMINI_API_KEY Worker secret.
const APP_KEYS = { gemini: 'GEMINI_API_KEY' };

async function keyCipher(env) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('stored-keys:' + env.APP_TOKEN));
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function sealKey(env, value) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyCipher(env), enc.encode(value));
  return b64(iv) + '.' + b64(ct);
}
async function openKey(env, sealed) {
  const [iv, ct] = sealed.split('.');
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, await keyCipher(env), fromB64(ct)));
}

/** env with the app-set keys filled in (they win over Worker secrets). */
async function withAppKeys(env) {
  const base = env.base || env; // always start from the Worker's own env, so a removed key really disappears
  const rows = await base.DB.prepare('SELECT name, value FROM app_keys').all().catch(() => ({ results: [] }));
  const out = { ...base, base, keySource: {} };
  for (const r of rows.results) {
    const name = APP_KEYS[r.name];
    if (!name) continue;
    try { out[name] = await openKey(env, r.value); out.keySource[r.name] = 'app'; } catch { /* APP_TOKEN changed: ignore the old value */ }
  }
  for (const [k, name] of Object.entries(APP_KEYS)) if (!out.keySource[k] && base[name]) out.keySource[k] = 'worker';
  return out;
}

const hint = v => (v ? '••••' + String(v).slice(-4) : '');

async function handleKeys(req, env, cors) {
  if (req.method === 'PUT') {
    const b = await readBody(req, 5000, 'json');
    const t = Date.now(), ops = [];
    for (const k of Object.keys(APP_KEYS)) {
      if (!(k in b)) continue;
      const v = typeof b[k] === 'string' ? b[k].trim() : '';
      if (!v) { ops.push(env.DB.prepare('DELETE FROM app_keys WHERE name = ?').bind(k)); continue; }
      if (v.length > 500 || /[^\x21-\x7E]/.test(v)) throw new HttpError(400, 'That key has characters that can’t be right');
      ops.push(env.DB.prepare('INSERT OR REPLACE INTO app_keys (name, value, updated_at) VALUES (?, ?, ?)').bind(k, await sealKey(env, v), t));
    }
    if (ops.length) await env.DB.batch(ops);
    env = await withAppKeys(env);
  } else if (req.method !== 'GET') throw new HttpError(405, 'method not allowed');
  return reply({
    gemini: { set: !!env.GEMINI_API_KEY, hint: hint(env.GEMINI_API_KEY), source: env.keySource.gemini || null },
  }, 200, cors);
}

/* ---------------- settings (key → JSON) ---------------- */

async function getSettings(env, keys) {
  const rows = await env.DB.prepare(`SELECT key, value FROM settings WHERE key IN (${keys.map(() => '?').join(',')})`).bind(...keys).all();
  const out = {};
  for (const r of rows.results) { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } }
  return out;
}
async function orgInfo(env) {
  const s = await getSettings(env, ['org', 'workspaceName']);
  const org = s.org && typeof s.org === 'object' ? s.org : {};
  return { name: org.name || s.workspaceName || 'Project Brain', logo: org.logo || '', color: org.color || '#0ea5e9', tz: org.tz || '', workStart: org.workStart || '09:00', workEnd: org.workEnd || '18:00' };
}

/* ---------------- projects in D1 ---------------- */

async function loadProject(env, id) {
  const row = await env.DB.prepare('SELECT data, updated_at FROM projects WHERE id = ?').bind(id).first();
  return row ? { p: JSON.parse(row.data), version: row.updated_at } : null;
}

/** Who (by account) is in each project, so a person's workspace is one lookup instead of a scan. */
function memberIndex(env, p) {
  const ids = [...new Set((p.members || []).filter(m => m.userId && !m.revokedAt).map(m => m.userId))];
  return [
    env.DB.prepare('DELETE FROM project_members WHERE project_id = ?').bind(p.id),
    ...ids.map(u => env.DB.prepare('INSERT OR REPLACE INTO project_members (project_id, user_id) VALUES (?, ?)').bind(p.id, u)),
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

/* ---------------- what an invited person sees ---------------- */

const memberOf = (p, user) => (p.members || []).find(m => m.userId === user.id && !m.revokedAt) || null;

/**
 * Scoped copy for an invited person: never the vault, asks, internal notes, the log, or anyone's email.
 * Suggestion reviewers also get the suggestions and every record they could be about.
 */
function memberCopy(p, me) {
  const perms = me.perms || {};
  const allowed = { task: perms.tasks, requirement: perms.requirements, decision: perms.decisions, file: perms.files, question: perms.suggestions, risk: perms.suggestions };
  return {
    id: p.id, name: p.name, client: p.client, description: p.description, color: p.color,
    cover: p.cover, avatar: p.avatar, archived: !!p.archived, createdAt: p.createdAt, metaAt: p.metaAt,
    status: p.status, deadline: p.deadline, progressOverride: p.progressOverride ?? null, fileFolders: p.fileFolders || [],
    messages: (p.messages || []).filter(m => !m.deleted).map(m => ({ id: m.id, from: m.from, memberId: m.memberId, text: m.text, ts: m.ts, attachments: m.attachments || [], voice: m.voice, replyTo: m.replyTo || null, analyzed: !!m.analyzed })),
    items: (p.items || []).filter(i => !i.deleted && i.type !== 'sensitive' && (allowed[i.type] || perms.suggestions))
      .map(i => ({ ...i, notes: [], history: (i.history || []).filter(h => h.action !== 'note' && h.action !== 'edit'), reading: undefined })),
    suggestions: perms.suggestions ? (p.suggestions || []).filter(s => s.type !== 'sensitive') : [],
    asks: [], log: [],
    members: (p.members || []).map(m => ({ id: m.id, userId: m.userId, name: m.name, role: m.role, designation: m.designation, revokedAt: m.revokedAt, createdAt: m.createdAt, perms: m.id === me.id ? perms : undefined })),
    summaries: perms.summary && Array.isArray(p.summaries) ? p.summaries.slice(-1) : [],
  };
}

/** Attachment ids someone may download: the ones referenced in what they can already see. */
function visibleBlobs(view) {
  return new Set([
    ...view.messages.flatMap(m => m.attachments.map(a => a.id)),
    ...view.items.map(i => i.file?.attachmentId),
    view.cover?.id, view.avatar?.id,
  ].filter(Boolean));
}

async function memberProjects(env, user) {
  const rows = await env.DB.prepare('SELECT p.data FROM project_members pm JOIN projects p ON p.id = pm.project_id WHERE pm.user_id = ?').bind(user.id).all();
  const out = [];
  for (const r of rows.results) {
    let p;
    try { p = JSON.parse(r.data); } catch { continue; }
    const me = memberOf(p, user);
    if (me) out.push({ p, me });
  }
  return out;
}

async function memberProject(env, user, pid) {
  const cur = await loadProject(env, pid);
  const me = cur && memberOf(cur.p, user);
  if (!me) throw new HttpError(404, 'project not found');
  return { p: cur.p, me };
}

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
    due: '', assignee: '', scope: '', kind: a.kind === 'voice' ? 'voice' : 'upload', folder: clip(body.folder, 80),
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

/**
 * A suggestion reviewer's decisions: suggestion states, the records accepting them created or changed,
 * log entries, and "this message was read by the AI" marks. Never the vault, members or project details.
 */
function reviewerDelta(p, me, body) {
  const vault = new Set((p.items || []).filter(i => i.type === 'sensitive').map(i => i.id));
  const msgs = new Map((p.messages || []).map(m => [m.id, m]));
  const arr = x => (Array.isArray(x) ? x.slice(0, 500) : []);
  const items = arr(body.items).filter(i => i && typeof i.id === 'string' && i.type !== 'sensitive' && !vault.has(i.id) && i.type);
  const suggestions = arr(body.suggestions).filter(s => s && typeof s.id === 'string' && s.type !== 'sensitive' && !(s.targetId && vault.has(s.targetId)));
  const log = arr(body.log).filter(e => e && typeof e.id === 'string').map(e => ({ ...e, actor: me.id }));
  const messages = arr(body.analyzed).filter(id => msgs.has(id)).map(id => ({ ...msgs.get(id), analyzed: true }));
  return { id: p.id, metaAt: 0, items, suggestions, log, messages };
}

/* ---------------- invitation emails (Cloudflare Email Service) ---------------- */

// Sent through the `send_email` binding named EMAIL, from EMAIL_FROM (wrangler.toml). That needs a domain onboarded
// to Cloudflare Email Service, and the Workers Paid plan to email people outside your own verified addresses.
// Until both are set up the owner gets the link to send themselves.
const EMAIL_ERRORS = {
  E_SENDER_DOMAIN_NOT_AVAILABLE: 'the sending domain isn’t onboarded to Cloudflare Email Service yet',
  E_SENDER_NOT_VERIFIED: 'the sending domain isn’t verified yet',
  E_RECIPIENT_NOT_ALLOWED: 'Cloudflare only allows your verified addresses on this plan (emailing anyone needs Workers Paid)',
  E_RECIPIENT_SUPPRESSED: 'that address bounced or complained before, so Cloudflare won’t email it',
  E_DAILY_LIMIT_EXCEEDED: 'today’s sending limit is used up',
  E_RATE_LIMIT_EXCEEDED: 'sending too fast — try again in a minute',
};

async function sendInvite(env, { to, name, link, org, inviter, label }) {
  if (!env.EMAIL || !env.EMAIL_FROM) return { sent: false, reason: 'Email sending isn’t set up yet.' };
  const color = /^#[0-9a-f]{6}$/i.test(org.color) ? org.color : '#0ea5e9';
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">
    <h2 style="margin:0 0 4px">${esc(org.name)}</h2>
    <p style="color:#555;margin:0 0 20px">Project Brain</p>
    <p>Hi ${esc(name || '')},</p>
    <p>${esc(inviter)} invited you to work together in <b>${esc(org.name)}</b> as <b>${esc(label)}</b>.</p>
    <p style="margin:28px 0"><a href="${esc(link)}" style="background:${color};color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">Accept invitation</a></p>
    <p style="color:#666;font-size:13px">Or open this link:<br><a href="${esc(link)}">${esc(link)}</a><br>It works for 7 days. You'll set a password and sign in with this email address.</p></div>`;
  const text = `Hi ${name || ''},\n\n${inviter} invited you to ${org.name} as ${label}.\n\nAccept the invitation (works for 7 days):\n${link}\n`;
  try {
    await env.EMAIL.send({ to, from: { email: env.EMAIL_FROM, name: org.name }, subject: `${inviter} invited you to ${org.name}`, html, text });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: `Couldn’t email it: ${EMAIL_ERRORS[e?.code] || e?.message || 'unknown error'}.` };
  }
}

/* ---------------- auth & invites ---------------- */

async function ownerExists(env) {
  return !!(await env.DB.prepare("SELECT 1 FROM users WHERE role = 'owner' LIMIT 1").first());
}

async function handleAuth(req, env, cors, path, isOk) {
  if (path === '/v1/auth/status' && req.method === 'GET') {
    return reply({ hasOwner: await ownerExists(env), org: await orgInfo(env) }, 200, cors);
  }

  if (path === '/v1/auth/setup' && req.method === 'POST') {
    const b = await readBody(req, 5000, 'json');
    if (await ownerExists(env)) throw new HttpError(409, 'This workspace already has an owner — sign in instead');
    if (!(await sameSecret(String(b.setupCode || ''), env.APP_TOKEN))) throw new HttpError(401, 'Wrong setup code');
    const email = normEmail(b.email);
    if (!validEmail(email)) throw new HttpError(400, 'Enter a valid email');
    checkPassword(b.password);
    const { hash, salt } = await hashPassword(b.password);
    const t = Date.now();
    const u = { id: rid('u_'), email, name: clip(b.name, 80).trim() || email.split('@')[0], role: 'owner', label: 'owner', tz: validTz(b.tz) ? b.tz : '', epoch: 0 };
    await env.DB.prepare(`INSERT INTO users (id, email, name, role, label, pass_hash, pass_salt, tz, epoch, created_at, updated_at)
      VALUES (?, ?, ?, 'owner', 'owner', ?, ?, ?, 0, ?, ?)`).bind(u.id, email, u.name, hash, salt, u.tz, t, t).run();
    const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first();
    return reply({ session: await newSession(env, row), user: publicUser(row) }, 200, cors);
  }

  if (path === '/v1/auth/login' && req.method === 'POST') {
    const b = await readBody(req, 5000, 'json');
    const email = normEmail(b.email), now = Date.now();
    const att = await env.DB.prepare('SELECT fails, locked_until FROM login_attempts WHERE email = ?').bind(email).first();
    if (att && att.locked_until > now) {
      const retryAfter = Math.ceil((att.locked_until - now) / 1000);
      throw new HttpError(429, `Too many wrong passwords — try again in ${Math.ceil(retryAfter / 60)} min`, { retryAfter });
    }
    const u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    const ok = u && u.pass_hash && !u.disabled && (await sameSecret((await hashPassword(String(b.password || ''), u.pass_salt)).hash, u.pass_hash));
    if (!ok) {
      if (!u) await hashPassword(String(b.password || '')); // same work either way, so timing doesn't reveal who has an account
      const fails = (att?.fails || 0) + 1, locked = fails >= LOGIN_MAX_FAILS;
      await env.DB.prepare('INSERT OR REPLACE INTO login_attempts (email, fails, locked_until) VALUES (?, ?, ?)').bind(email, locked ? 0 : fails, locked ? now + LOGIN_LOCK_MS : 0).run();
      throw new HttpError(locked ? 429 : 401, u?.disabled ? 'This account was turned off by the workspace owner' : locked ? 'Too many wrong passwords — try again in 15 min' : 'Wrong email or password');
    }
    if (att) await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run();
    if (!u.tz_manual && validTz(b.tz) && b.tz !== u.tz) {
      await env.DB.prepare('UPDATE users SET tz = ?, updated_at = ? WHERE id = ?').bind(b.tz, now, u.id).run();
      u.tz = b.tz;
    }
    return reply({ session: await newSession(env, u), user: publicUser(u) }, 200, cors);
  }

  // /v1/invites/:token[/accept]
  const [token, action] = path.slice('/v1/invites/'.length).split('/');
  const inv = token && await env.DB.prepare('SELECT i.expires_at, u.* FROM invites i JOIN users u ON u.id = i.user_id WHERE i.token = ?').bind(token).first();
  if (!inv || inv.expires_at < Date.now() || inv.disabled) throw new HttpError(404, 'This invitation is no longer valid — ask for a new one');
  const org = await orgInfo(env);
  if (!action && req.method === 'GET') {
    const owner = await env.DB.prepare("SELECT name FROM users WHERE role = 'owner' LIMIT 1").first();
    return reply({ email: inv.email, name: inv.name, label: inv.label, hasPassword: !!inv.pass_hash, org, inviter: owner?.name || org.name }, 200, cors);
  }
  if (action === 'accept' && req.method === 'POST') {
    const b = await readBody(req, 5000, 'json');
    checkPassword(b.password);
    const { hash, salt } = await hashPassword(b.password);
    const t = Date.now();
    const tz = validTz(b.tz) ? b.tz : inv.tz || '';
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET name = ?, pass_hash = ?, pass_salt = ?, tz = ?, epoch = epoch + 1, updated_at = ? WHERE id = ?')
        .bind(clip(b.name, 80).trim() || inv.name || inv.email.split('@')[0], hash, salt, tz, t, inv.id),
      env.DB.prepare('DELETE FROM invites WHERE user_id = ?').bind(inv.id),
    ]);
    const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(inv.id).first();
    return reply({ session: await newSession(env, u), user: publicUser(u) }, 200, cors);
  }
  throw new HttpError(405, 'method not allowed');
}

async function handleMe(req, env, cors, user) {
  if (req.method === 'GET') return reply({ user: publicUser(user), org: await orgInfo(env), ai: { gemini: !!env.GEMINI_API_KEY } }, 200, cors);
  if (req.method !== 'PATCH') throw new HttpError(405, 'method not allowed');
  const b = await readBody(req, 5000, 'json');
  const set = [], vals = [];
  if (typeof b.name === 'string' && b.name.trim()) { set.push('name = ?'); vals.push(clip(b.name, 80).trim()); }
  if ('tz' in b) { if (b.tz && !validTz(b.tz)) throw new HttpError(400, 'Unknown time zone'); set.push('tz = ?', 'tz_manual = ?'); vals.push(b.tz || '', b.tz ? 1 : 0); }
  if (validHM(b.workStart)) { set.push('work_start = ?'); vals.push(b.workStart); }
  if (validHM(b.workEnd)) { set.push('work_end = ?'); vals.push(b.workEnd); }
  if (b.newPassword) {
    if (!(await sameSecret((await hashPassword(String(b.password || ''), user.pass_salt)).hash, user.pass_hash))) throw new HttpError(401, 'Your current password is wrong');
    checkPassword(b.newPassword);
    const { hash, salt } = await hashPassword(b.newPassword);
    set.push('pass_hash = ?', 'pass_salt = ?', 'epoch = epoch + 1'); vals.push(hash, salt);
  }
  if (set.length) await env.DB.prepare(`UPDATE users SET ${set.join(', ')}, updated_at = ? WHERE id = ?`).bind(...vals, Date.now(), user.id).run();
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return reply({ user: publicUser(u), ...(b.newPassword ? { session: await newSession(env, u) } : {}) }, 200, cors);
}

/* ---------------- people (owner) ---------------- */

async function inviteLink(env, user, appUrl, isOk) {
  let base;
  try { const u = new URL(appUrl); if (!isOk(u.origin)) throw new Error(); base = u.origin + u.pathname; } catch { throw new HttpError(400, 'appUrl must be this app’s address'); }
  const token = randToken();
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM invites WHERE user_id = ?').bind(user.id),
    env.DB.prepare('INSERT INTO invites (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').bind(token, user.id, t + INVITE_MS, t),
  ]);
  return `${base}#/invite/${token}`;
}

async function handlePeople(req, env, cors, path, owner, isOk) {
  const LABELS = ['client', 'designer', 'developer', 'video', 'motion', 'graphics', 'brand', 'other'];
  if (path === '/v1/people' && req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
    return reply({ people: rows.results.map(u => publicUser(u)) }, 200, cors);
  }
  if (path === '/v1/people/invite' && req.method === 'POST') {
    const b = await readBody(req, 5000, 'json');
    const email = normEmail(b.email);
    if (!validEmail(email)) throw new HttpError(400, 'Enter a valid email');
    const label = LABELS.includes(b.label) ? b.label : 'client';
    let u = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (u?.role === 'owner') throw new HttpError(400, 'That’s your own email');
    const t = Date.now();
    if (!u) {
      const id = rid('u_');
      await env.DB.prepare(`INSERT INTO users (id, email, name, role, label, epoch, created_at, updated_at) VALUES (?, ?, ?, 'member', ?, 0, ?, ?)`)
        .bind(id, email, clip(b.name, 80).trim(), label, t, t).run();
      u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
    } else if (!u.pass_hash) {
      await env.DB.prepare('UPDATE users SET label = ?, name = COALESCE(NULLIF(?, \'\'), name), disabled = 0, updated_at = ? WHERE id = ?').bind(label, clip(b.name, 80).trim(), t, u.id).run();
      u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first();
    }
    // someone who already has an account just gets access to more projects; no new link needed
    if (u.pass_hash) return reply({ user: publicUser(u), link: null, emailed: false, existing: true }, 200, cors);
    const link = await inviteLink(env, u, b.appUrl, isOk);
    const org = await orgInfo(env);
    const mail = await sendInvite(env, { to: email, name: u.name, link, org, inviter: owner.name, label: b.labelName || label });
    return reply({ user: publicUser(u), link, emailed: mail.sent, emailError: mail.reason || null }, 200, cors);
  }
  const [id, action] = path.slice('/v1/people/'.length).split('/');
  const u = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!u || u.role === 'owner') throw new HttpError(404, 'person not found');
  if (action === 'reinvite' && req.method === 'POST') {
    if (u.pass_hash) throw new HttpError(400, 'They already have an account');
    const b = await readBody(req, 5000, 'json');
    const link = await inviteLink(env, u, b.appUrl, isOk);
    const mail = await sendInvite(env, { to: u.email, name: u.name, link, org: await orgInfo(env), inviter: owner.name, label: b.labelName || u.label });
    return reply({ user: publicUser(u), link, emailed: mail.sent, emailError: mail.reason || null }, 200, cors);
  }
  if (!action && req.method === 'PATCH') {
    const b = await readBody(req, 5000, 'json');
    const set = [], vals = [];
    if (typeof b.name === 'string' && b.name.trim()) { set.push('name = ?'); vals.push(clip(b.name, 80).trim()); }
    if (LABELS.includes(b.label)) { set.push('label = ?'); vals.push(b.label); }
    if ('tz' in b) { if (b.tz && !validTz(b.tz)) throw new HttpError(400, 'Unknown time zone'); set.push('tz = ?', 'tz_manual = ?'); vals.push(b.tz || '', b.tz ? 1 : 0); }
    if (validHM(b.workStart)) { set.push('work_start = ?'); vals.push(b.workStart); }
    if (validHM(b.workEnd)) { set.push('work_end = ?'); vals.push(b.workEnd); }
    if (typeof b.disabled === 'boolean') { set.push('disabled = ?', 'epoch = epoch + 1'); vals.push(b.disabled ? 1 : 0); }
    if (set.length) await env.DB.prepare(`UPDATE users SET ${set.join(', ')}, updated_at = ? WHERE id = ?`).bind(...vals, Date.now(), u.id).run();
    if (b.disabled) await env.DB.prepare('DELETE FROM invites WHERE user_id = ?').bind(u.id).run();
    return reply({ user: publicUser(await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first()) }, 200, cors);
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
  // D1 returns BLOB columns as an array of byte values
  return new Response(r.data instanceof Uint8Array ? r.data : new Uint8Array(r.data), { headers });
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
      env.DB.prepare("SELECT * FROM settings WHERE key NOT LIKE 'draft_%'"),
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
        if (['apiKey', 'workerToken', 'workerUrl'].includes(k) || k.startsWith('draft_')) continue; // keys never leave the owner's browser
        statements.push(env.DB.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
          ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3 WHERE ?3 >= settings.updated_at`).bind(k, JSON.stringify(v), at));
      }
    }
    if (statements.length) await env.DB.batch(statements);
    return reply({ ok: true, syncedProjects: projects.length, serverTime: now }, 200, cors);
  }
  throw new HttpError(405, 'method not allowed');
}

/* ---------------- invited people's workspace ---------------- */

async function handleMember(req, env, cors, path, user) {
  if (path === '/v1/m/workspace' && req.method === 'GET') {
    const mine = await memberProjects(env, user);
    const s = await getSettings(env, ['templates', 'ownerName', 'provider', 'model', 'cfModel', 'autoAnalyze']);
    const owner = await env.DB.prepare("SELECT * FROM users WHERE role = 'owner' LIMIT 1").first();
    const ids = new Set([owner?.id, ...mine.flatMap(({ p }) => (p.members || []).filter(m => m.userId && !m.revokedAt).map(m => m.userId))].filter(Boolean));
    const rows = ids.size ? await env.DB.prepare(`SELECT * FROM users WHERE id IN (${[...ids].map(() => '?').join(',')})`).bind(...ids).all() : { results: [] };
    return reply({
      user: publicUser(user), org: await orgInfo(env),
      owner: owner ? publicUser(owner, false) : null,
      ownerName: s.ownerName || owner?.name || 'Owner',
      templates: Array.isArray(s.templates) ? s.templates : [],
      ai: { provider: s.provider || 'gemini', model: s.model || '', cfModel: s.cfModel || '', gemini: !!env.GEMINI_API_KEY, autoAnalyze: s.autoAnalyze !== false },
      people: rows.results.map(u => publicUser(u, false)),
      projects: mine.map(({ p, me }) => memberCopy(p, me)),
    }, 200, cors);
  }

  if (path.startsWith('/v1/m/blobs/')) {
    const id = decodeURIComponent(path.slice('/v1/m/blobs/'.length));
    if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'bad blob id');
    if (req.method === 'GET') {
      const mine = await memberProjects(env, user);
      if (!mine.some(({ p, me }) => visibleBlobs(memberCopy(p, me)).has(id))) throw new HttpError(404, 'blob not found');
      return getBlob(env, cors, id);
    }
    if (req.method === 'PUT') {
      if (await blobExists(env, id)) throw new HttpError(409, 'blob already exists'); // add files, never replace one
      return putBlob(req, env, cors, id);
    }
    throw new HttpError(405, 'method not allowed');
  }

  const m = path.match(/^\/v1\/m\/projects\/([\w-]+)\/(msg|apply)$/);
  if (m && req.method === 'POST') {
    const { p, me } = await memberProject(env, user, m[1]);
    const body = await readBody(req, Number(env.MAX_BODY_BYTES) || 400000, 'json');
    if (m[2] === 'msg') {
      const { delta, message } = memberMessage(p, me, body || {});
      const saved = await saveMerged(env, delta);
      return reply({ ok: true, message, project: memberCopy(saved, me) }, 200, cors);
    }
    if (!me.perms?.suggestions) throw new HttpError(403, 'You can’t review suggestions in this project');
    const saved = await saveMerged(env, reviewerDelta(p, me, body || {}));
    return reply({ ok: true, project: memberCopy(saved, me) }, 200, cors);
  }
  throw new HttpError(404, 'not found');
}

/* ---------------- drafts ---------------- */

async function handleDraft(req, env, cors, path, user) {
  const pid = decodeURIComponent(path.slice('/v1/drafts/'.length));
  if (!/^[\w-]+$/.test(pid)) throw new HttpError(400, 'bad project id');
  if (user.role !== 'owner') await memberProject(env, user, pid);
  if (req.method === 'GET') {
    const r = await env.DB.prepare('SELECT value FROM drafts WHERE user_id = ? AND project_id = ?').bind(user.id, pid).first();
    let draft = null;
    if (r?.value) { try { draft = JSON.parse(r.value); } catch { draft = null; } }
    return reply({ draft }, 200, cors);
  }
  if (req.method === 'PUT') {
    const b = await readBody(req, 200000, 'json');
    const ts = Number(b.ts) || Date.now();
    if (!String(b.text || '').trim() && !String(b.html || '').replace(/<[^>]*>|&nbsp;/g, '').trim()) {
      await env.DB.prepare('DELETE FROM drafts WHERE user_id = ? AND project_id = ? AND updated_at <= ?').bind(user.id, pid, ts).run();
      return reply({ ok: true, cleared: true }, 200, cors);
    }
    const val = JSON.stringify({ text: clip(b.text, 50000), html: clip(b.html, 150000), replyTo: b.replyTo || null, caret: Number(b.caret) || 0, ts });
    // the newest edit wins, whichever device it came from
    await env.DB.prepare(`INSERT INTO drafts (user_id, project_id, value, updated_at) VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(user_id, project_id) DO UPDATE SET value = ?3, updated_at = ?4 WHERE ?4 >= drafts.updated_at`).bind(user.id, pid, val, ts).run();
    return reply({ ok: true }, 200, cors);
  }
  if (req.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM drafts WHERE user_id = ? AND project_id = ?').bind(user.id, pid).run();
    return reply({ ok: true }, 200, cors);
  }
  throw new HttpError(405, 'method not allowed');
}

/* ---------------- AI ---------------- */

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
const modelId = m => String(m || '').trim().replace(/^models\//, '');

async function handleAI(req, env, cors, user) {
  const body = await readBody(req, Number(env.MAX_AI_BYTES) || 4_000_000, 'json');
  const { prompt, system, schema, images } = body || {};
  if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, 'prompt is required');
  const s = await getSettings(env, ['provider', 'model', 'cfModel']);
  const owner = user.role === 'owner';
  // the owner may test a provider/model before saving it
  const provider = (owner && body.provider) || (s.provider === 'cloudflare' ? 'cloudflare' : 'gemini');
  const temperature = Math.min(1, Math.max(0, Number(body.temperature ?? 0.2)));

  if (!owner) {
    const day = new Date().toISOString().slice(0, 10), limit = Number(env.AI_DAILY_LIMIT) || 200;
    const r = await env.DB.prepare(`INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
      ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 RETURNING count`).bind(user.id, day).first();
    if (r.count > limit) throw new HttpError(429, `Daily AI limit reached (${limit} requests) — it resets tomorrow`);
  }

  if (provider === 'gemini') {
    if (!env.GEMINI_API_KEY) throw new HttpError(503, 'No Gemini key yet — the owner can add it in Settings → AI');
    const model = modelId((owner && body.model) || s.model || 'gemini-3.5-flash-lite');
    const parts = [{ text: (system && !body.json ? system + '\n\n' : '') + prompt },
      ...(Array.isArray(images) ? images.slice(0, 6) : []).map(im => ({ inline_data: { mime_type: clip(im.mime, 40), data: String(im.data || '') } }))];
    const r = await fetch(`${GEMINI}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature, ...(body.json ? { responseMimeType: 'application/json' } : {}) } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new HttpError(502, `Gemini: ${j.error?.message || r.status}`);
    const text = (j.candidates?.[0]?.content?.parts || []).map(x => x.text || '').join('');
    if (!text) throw new HttpError(502, j.promptFeedback?.blockReason ? `Gemini blocked it (${j.promptFeedback.blockReason})` : 'Gemini returned nothing');
    return reply({ provider, model, output: text }, 200, cors);
  }

  if (images?.length) throw new HttpError(400, 'only Gemini can look at images');
  const allowed = list(env.ALLOWED_MODELS);
  const want = (owner && body.model) || s.cfModel;
  const useModel = want && allowed.includes(want) ? want : env.DEFAULT_MODEL;
  const max_tokens = Math.min(4096, Math.max(64, Number(body.maxTokens) || 2048));
  const messages = [...(typeof system === 'string' && system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }];
  const base = { messages, temperature, max_tokens };
  try {
    if (schema && typeof schema === 'object') {
      try {
        const r = await env.AI.run(useModel, { ...base, response_format: { type: 'json_schema', json_schema: schema } });
        return reply({ provider, model: useModel, output: r.response, jsonMode: true }, 200, cors);
      } catch { /* model refused JSON mode: fall back to plain text */ }
    }
    const r = await env.AI.run(useModel, base);
    return reply({ provider, model: useModel, output: r.response, jsonMode: false }, 200, cors);
  } catch (e) {
    throw new HttpError(502, `Workers AI: ${e?.message || e}`);
  }
}

async function handleModels(env, cors) {
  if (!env.GEMINI_API_KEY) throw new HttpError(503, 'The Gemini key isn’t set on the server yet');
  const r = await fetch(`${GEMINI}/models?pageSize=200`, { headers: { 'x-goog-api-key': env.GEMINI_API_KEY } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `Gemini: ${j.error?.message || r.status}`);
  const models = (j.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => modelId(m.name));
  return reply({ models }, 200, cors);
}

/* ---------------- link previews ---------------- */

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd][0-9a-f]{2}:)/i;

function metaTags(html) {
  const out = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const key = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const val = (tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1];
    if (key && val && !(key.toLowerCase() in out)) out[key.toLowerCase()] = val;
  }
  return out;
}
const decodeEntities = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).trim();

/** Can this page be shown in an iframe on another site? */
function frameable(headers) {
  const xfo = (headers.get('x-frame-options') || '').toLowerCase();
  if (xfo.includes('deny') || xfo.includes('sameorigin')) return false;
  const fa = (headers.get('content-security-policy') || '').match(/frame-ancestors([^;]*)/i);
  if (fa && !/(^|\s)\*(\s|$)|https:(\s|$)/.test(fa[1])) return false;
  return true;
}

async function handleUnfurl(env, cors, raw) {
  let url;
  try { url = new URL(raw); } catch { throw new HttpError(400, 'bad url'); }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname) || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && PRIVATE_HOST.test(url.hostname + '.')) throw new HttpError(400, 'url not allowed');
  const key = url.href.slice(0, 1000);
  const hit = await env.DB.prepare('SELECT data, fetched_at FROM unfurls WHERE url = ?').bind(key).first();
  if (hit && hit.fetched_at > Date.now() - UNFURL_TTL) return reply(JSON.parse(hit.data), 200, cors);

  let data = { url: key, title: url.hostname.replace(/^www\./, ''), description: '', image: '', siteName: url.hostname.replace(/^www\./, ''), favicon: `${url.origin}/favicon.ico`, embeddable: false, kind: 'page' };
  try {
    const res = await fetch(url.href, {
      redirect: 'follow', signal: AbortSignal.timeout(6000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProjectBrainPreview/1.0)', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    });
    const type = res.headers.get('content-type') || '';
    data.embeddable = res.ok && frameable(res.headers);
    if (type.startsWith('image/')) data = { ...data, kind: 'image', image: res.url, title: decodeURIComponent(url.pathname.split('/').pop() || data.title) };
    else if (type.includes('pdf')) data = { ...data, kind: 'pdf', title: decodeURIComponent(url.pathname.split('/').pop() || data.title) };
    else if (type.includes('html')) {
      const reader = res.body.getReader();
      let html = '', size = 0;
      while (size < 400000) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        html += new TextDecoder().decode(value, { stream: true });
        if (/<\/head>/i.test(html)) break;
      }
      reader.cancel().catch(() => {});
      const m = metaTags(html);
      const abs = u => { try { return u ? new URL(decodeEntities(u), res.url).href : ''; } catch { return ''; } };
      const icon = (html.match(/<link\b[^>]*rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*>/i) || [''])[0].match(/href\s*=\s*["']([^"']+)["']/i);
      data = {
        ...data,
        title: decodeEntities(m['og:title'] || m['twitter:title'] || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || data.title).slice(0, 300),
        description: decodeEntities(m['og:description'] || m['twitter:description'] || m.description || '').slice(0, 500),
        image: abs(m['og:image'] || m['og:image:url'] || m['twitter:image'] || m['twitter:image:src']),
        siteName: decodeEntities(m['og:site_name'] || data.siteName).slice(0, 100),
        favicon: icon ? abs(icon[1]) : data.favicon,
      };
    }
  } catch { /* unreachable: keep the basic card */ }
  await env.DB.prepare('INSERT OR REPLACE INTO unfurls (url, data, fetched_at) VALUES (?, ?, ?)').bind(key, JSON.stringify(data), Date.now()).run();
  return reply(data, 200, cors);
}

/* ---------------- router ---------------- */

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const isOk = o => list(env.ALLOWED_ORIGINS).includes(o) || /^https:\/\/[a-z0-9_-]+\.project-brain-557\.pages\.dev$/i.test(o);
    const okOrigin = isOk(origin);
    const cors = okOrigin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Attachment-Mime, X-Attachment-Enc',
      'Access-Control-Expose-Headers': 'X-Encrypted, Retry-After',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    } : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: okOrigin ? 204 : 403, headers: cors });
    if (!okOrigin) return reply({ error: 'origin not allowed' }, 403, cors);
    if (!env.APP_TOKEN) return reply({ error: 'APP_TOKEN secret is not set on the Worker' }, 500, cors);

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '');
    try {
      if (path === '/v1/health') return reply({ status: 'ok', time: Date.now() }, 200, cors);
      if (path.startsWith('/v1/auth/') && path !== '/v1/auth/me' || path.startsWith('/v1/invites/')) return await handleAuth(req, env, cors, path, isOk);

      const user = await sessionUser(env, req);
      if (!user) return reply({ error: 'signed out' }, 401, cors);
      env = await withAppKeys(env);
      const owner = user.role === 'owner';

      if (path === '/v1/auth/me') return await handleMe(req, env, cors, user);
      if (path === '/v1/ai' && req.method === 'POST') return await handleAI(req, env, cors, user);
      if (path === '/v1/unfurl' && req.method === 'GET') return await handleUnfurl(env, cors, url.searchParams.get('url') || '');
      if (path.startsWith('/v1/drafts/')) return await handleDraft(req, env, cors, path, user);
      if (path.startsWith('/v1/m/')) return await handleMember(req, env, cors, path, user);

      if (!owner) return reply({ error: 'owner only' }, 403, cors);
      if (path === '/v1/sync') return await handleSync(req, env, cors);
      if (path === '/v1/ai/models') return await handleModels(env, cors);
      if (path === '/v1/admin/keys') return await handleKeys(req, env, cors);
      if (path.startsWith('/v1/people')) return await handlePeople(req, env, cors, path, user, isOk);
      if (path.startsWith('/v1/blobs/')) {
        const id = decodeURIComponent(path.slice('/v1/blobs/'.length));
        if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'bad blob id');
        if (req.method === 'GET') return await getBlob(env, cors, id);
        if (req.method === 'PUT') return await putBlob(req, env, cors, id);
        throw new HttpError(405, 'method not allowed');
      }
      return reply({ error: 'not found' }, 404, cors);
    } catch (e) {
      if (e instanceof HttpError) {
        const h = e.extra.retryAfter ? { 'Retry-After': String(e.extra.retryAfter) } : {};
        return reply({ error: e.message, ...e.extra }, e.status, cors, h);
      }
      return reply({ error: 'server error: ' + (e?.message || e) }, 500, cors);
    }
  },
};
