// Small shared helpers.

let clock = () => Date.now();
export const now = () => clock();
/** Run fn with a fixed clock (used to build back-dated demo data). */
export function withClock(t, fn) {
  const prev = clock;
  clock = () => t;
  try { return fn(); } finally { clock = prev; }
}

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
export const cx = (...a) => a.filter(Boolean).join(' ');
export const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const clone = o => structuredClone(o);
export const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayISO = () => toISO(new Date());
export const fromISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export const fmtTime = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDateTime = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export function fmtDay(t) {
  const d = new Date(t), n = new Date(), y = new Date();
  y.setDate(n.getDate() - 1);
  if (d.toDateString() === n.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
export function fmtRel(t) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function fmtDue(iso) {
  if (!iso) return '';
  const d = fromISO(iso), t = fromISO(todayISO());
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export const isOverdue = iso => !!iso && iso < todayISO();
export const fmtSize = b => (b == null ? '' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');

const STOP = new Set(('the and for you your with this that have from are was were will can could would should please also just like need want make sure into they them their our ours there here what when where which while been being some more most very much than then thanks thank okay yes not but all any its let lets get got actually again really maybe now pls plz one too did does done').split(' '));
/** Lower-cased, de-pluralised content words used for fuzzy matching. */
export function keywords(s) {
  const ws = ((s || '').toLowerCase().match(/[a-z]{3,}|\d{2,}/g) || [])
    .map(w => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .filter(w => !STOP.has(w));
  return [...new Set(ws)];
}
/** Overlap between two texts: {score 0..1, inter = shared keywords}. */
export function overlap(a, b) {
  const A = keywords(a), B = new Set(keywords(b));
  if (!A.length || !B.size) return { score: 0, inter: 0 };
  const inter = A.filter(w => B.has(w)).length;
  return { score: inter / Math.min(A.length, B.size), inter };
}

export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}
export function flash(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  return true;
}
export const secureDigits = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b % 10).join('');

/** Short stable id from a string (FNV-1a, two rounds). Same input → same id in every tab. */
export function hashId(s) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 15);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}

/** Scroll to an element and play the highlight animation, without the generic id lookup. */
export function flashEl(el, block = 'center') {
  if (!el) return false;
  el.scrollIntoView({ behavior: 'smooth', block });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
  return true;
}
