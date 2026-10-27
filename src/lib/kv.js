// Tiny IndexedDB key-value store (much more room than localStorage for attachments).

let dbp;
const db = () => (dbp ??= new Promise((res, rej) => {
  const r = indexedDB.open('project-brain', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));

const run = (mode, fn) => db().then(d => new Promise((res, rej) => {
  const req = fn(d.transaction('kv', mode).objectStore('kv'));
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
}));

export const get = k => run('readonly', s => s.get(k));
export const set = (k, v) => run('readwrite', s => s.put(v, k));
export const del = k => run('readwrite', s => s.delete(k));
export const keys = () => run('readonly', s => s.getAllKeys());
