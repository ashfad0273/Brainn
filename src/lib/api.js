// The sync server (worker/). Its address comes from VITE_WORKER_URL at build time; without it the app
// runs local-only in this browser, as it always could. Signed-in requests carry the session token.

const BASE = String(import.meta.env.VITE_WORKER_URL || '').replace(/\/+$/, '');
const KEY = 'pb-session';

export const hasServer = () => !!BASE;
export const serverUrl = path => BASE + path;

export function getSession() { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } }
export function setSession(s) { try { localStorage.setItem(KEY, s); } catch { /* private mode */ } }
export function clearSession() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } }
export const authHeader = () => (getSession() ? { Authorization: 'Session ' + getSession() } : {});

export class ApiError extends Error {
  constructor(status, message, body) { super(message); this.status = status; this.body = body; }
}

/** JSON in, JSON out. A 401 on a signed-in request means the session ended: everyone listening is told. */
export async function api(path, { method = 'GET', json, body, headers = {}, keepalive, raw } = {}) {
  if (!BASE) throw new ApiError(0, 'No server is configured (VITE_WORKER_URL)');
  let res;
  try {
    res = await fetch(BASE + path, {
      method, keepalive,
      headers: { ...authHeader(), ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : body,
    });
  } catch (e) {
    throw new ApiError(0, `Could not reach the server (${e.message})`);
  }
  if (raw) {
    if (res.status === 401 && getSession()) signedOut();
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && getSession() && !path.startsWith('/v1/auth/')) signedOut();
    throw new ApiError(res.status, data.error || `HTTP ${res.status}`, data);
  }
  return data;
}

function signedOut() {
  clearSession();
  window.dispatchEvent(new Event('pb-signed-out'));
}

export const browserTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } };
