// Attachment files, stored byte-for-byte as Blobs in IndexedDB under "blob:<attachment id>".
// With encryption on, the bytes are AES-GCM encrypted with the workspace key.

import { useEffect, useState } from 'react';
import * as kv from './kv';
import * as vault from './crypto';

let key = null;
export const setBlobKey = k => { key = k; };
// Remote copy on the sync Worker: the owner uses their bearer token; a member portal uses its
// session on the /v1/join routes. A member portal, while open, takes precedence.
let owner = null, member = null;
export const setBlobRemote = cfg => { owner = cfg?.workerUrl && cfg?.workerToken ? cfg : null; };
export const setBlobMember = cfg => { member = cfg; };
function remote(id) {
  if (member) return { url: `${member.base}/v1/join/${encodeURIComponent(member.token)}/blobs/${encodeURIComponent(id)}`, auth: 'Member ' + member.session, member: true };
  if (owner) return { url: `${owner.workerUrl.replace(/\/+$/, '')}/v1/blobs/${encodeURIComponent(id)}`, auth: 'Bearer ' + owner.workerToken.trim() };
  return null;
}
const K = id => 'blob:' + id;

export const isQuotaError = e => e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '');

export async function putBlob(id, file) {
  const mime = file.type || '';
  let upload;
  if (key) {
    const { iv, ct } = await vault.encryptBytes(key, await file.arrayBuffer());
    await kv.set(K(id), { enc: true, mime, iv, ct });
    upload = new Blob([iv, ct]); // the server only ever gets the ciphertext: 12-byte IV, then the AES-GCM output
  } else {
    await kv.set(K(id), { enc: false, mime, blob: file });
    upload = file;
  }
  const r = remote(id);
  if (!r) return;
  const sent = fetch(r.url, {
    method: 'PUT',
    headers: { Authorization: r.auth, 'X-Attachment-Mime': mime, 'X-Attachment-Enc': key && !r.member ? '1' : '0' },
    body: r.member && key ? file : upload,
  }).then(async res => {
    if (!res.ok) {
      if (res.status === 413) throw new Error('File exceeds database storage limit (~1.8 MB). Enable Cloudflare R2 for larger files.');
      let errText = '';
      try { const j = await res.json(); errText = j.error; } catch {}
      throw new Error(errText || `upload failed (${res.status})`);
    }
  });
  // a member's message is only visible to the owner through the server, so its file must be there first
  if (r.member) await sent;
  else sent.catch(e => console.warn('blob upload', id, e));
}

/** Copy from the sync Worker into IndexedDB (encrypted with the workspace key when there is one). */
async function fetchRemote(id) {
  const r = remote(id);
  if (!r) return null;
  const res = await fetch(r.url, { headers: { Authorization: r.auth } }).catch(() => null);
  if (!res?.ok) return null;
  const mime = res.headers.get('Content-Type') || '';
  const buf = await res.arrayBuffer();
  let rec;
  if (res.headers.get('X-Encrypted') === '1') rec = { enc: true, mime, iv: new Uint8Array(buf.slice(0, 12)), ct: buf.slice(12) };
  else if (key) rec = { enc: true, mime, ...(await vault.encryptBytes(key, buf)) };
  else rec = { enc: false, mime, blob: new Blob([buf], { type: mime }) };
  await kv.set(K(id), rec);
  return rec;
}

/** → Blob, or null if no stored copy exists. Throws if the stored copy is encrypted and the workspace is locked. */
export async function getBlob(id, expectedSize) {
  let r = await kv.get(K(id));
  if (r && !r.enc && expectedSize && r.blob && Math.abs(r.blob.size - expectedSize) > 0) {
    // Corrupted or size mismatch — drop local cache and refetch from remote
    await kv.del(K(id));
    r = null;
  }
  if (!r) r = await fetchRemote(id);
  if (!r) return null;
  if (!r.enc) return r.blob;
  if (!key) throw new Error(member ? 'This file is encrypted in the owner\'s workspace' : 'Workspace is locked');
  return new Blob([await vault.decryptBytes(key, r)], { type: r.mime });
}

/** After encryption is turned on/off or the passphrase changes: rewrite every stored file with the current key. */
export async function reencryptAll(oldKey) {
  for (const k of await kv.keys()) {
    if (typeof k !== 'string' || !k.startsWith('blob:')) continue;
    const r = await kv.get(k);
    if (!r) continue;
    let bytes;
    if (r.enc) bytes = await vault.decryptBytes(oldKey, r);
    else if (!key) continue; // plain → still plain
    else bytes = await r.blob.arrayBuffer();
    if (key) { const e = await vault.encryptBytes(key, bytes); await kv.set(k, { enc: true, mime: r.mime, ...e }); }
    else await kv.set(k, { enc: false, mime: r.mime, blob: new Blob([bytes], { type: r.mime }) });
  }
}

/** Does this attachment have a copy we can open? (legacy inline data URL or a stored blob) */
export const hasFile = a => !!(a && (a.dataUrl || a.stored));

/** Resolves to { url, revoke }. Legacy data URLs pass through untouched. */
export async function openUrl(a, forceFresh = false) {
  if (a.dataUrl) return { url: a.dataUrl, revoke() {} };
  if (forceFresh) await kv.del(K(a.id));
  const b = await getBlob(a.id, a.size);
  if (!b) throw new Error('No stored copy of ' + a.name);
  const url = URL.createObjectURL(b);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/** Object URL for an attachment, created on demand and revoked on unmount. */
export function useAttachmentUrl(a, enabled = true) {
  const [st, setSt] = useState({ url: null, failed: false });
  const [rev, setRev] = useState(0);
  const retry = () => setRev(v => v + 1);

  useEffect(() => {
    if (!enabled || !hasFile(a)) { setSt({ url: null, failed: false }); return; }
    let dead = false, h = null;
    openUrl(a, rev > 0).then(r => { if (dead) r.revoke(); else { h = r; setSt({ url: r.url, failed: false }); } })
      .catch(() => !dead && setSt({ url: null, failed: true }));
    return () => { dead = true; h?.revoke(); };
  }, [a?.id, a?.dataUrl, a?.stored, enabled, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...st, retry };
}

export async function downloadAttachment(a) {
  const r = await openUrl(a);
  const el = document.createElement('a');
  el.href = r.url; el.download = a.name; el.click();
  setTimeout(r.revoke, 10000);
}
