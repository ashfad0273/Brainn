// Attachment files, stored byte-for-byte as Blobs in IndexedDB under "blob:<attachment id>".
// With encryption on, the bytes are AES-GCM encrypted with the workspace key.

import { useEffect, useState } from 'react';
import * as kv from './kv';
import * as vault from './crypto';

let key = null;
export const setBlobKey = k => { key = k; };
const K = id => 'blob:' + id;

export const isQuotaError = e => e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '');

export async function putBlob(id, file) {
  const mime = file.type || '';
  if (key) {
    const { iv, ct } = await vault.encryptBytes(key, await file.arrayBuffer());
    await kv.set(K(id), { enc: true, mime, iv, ct });
  } else {
    await kv.set(K(id), { enc: false, mime, blob: file });
  }
}

/** → Blob, or null if no stored copy exists. Throws if the stored copy is encrypted and the workspace is locked. */
export async function getBlob(id) {
  const r = await kv.get(K(id));
  if (!r) return null;
  if (!r.enc) return r.blob;
  if (!key) throw new Error('Workspace is locked');
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
export async function openUrl(a) {
  if (a.dataUrl) return { url: a.dataUrl, revoke() {} };
  const b = await getBlob(a.id);
  if (!b) throw new Error('No stored copy of ' + a.name);
  const url = URL.createObjectURL(b);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/** Object URL for an attachment, created on demand and revoked on unmount. */
export function useAttachmentUrl(a, enabled = true) {
  const [st, setSt] = useState({ url: null, failed: false });
  useEffect(() => {
    if (!enabled || !hasFile(a)) { setSt({ url: null, failed: false }); return; }
    let dead = false, h = null;
    openUrl(a).then(r => { if (dead) r.revoke(); else { h = r; setSt({ url: r.url, failed: false }); } })
      .catch(() => !dead && setSt({ url: null, failed: true }));
    return () => { dead = true; h?.revoke(); };
  }, [a.id, a.dataUrl, a.stored, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}

export async function downloadAttachment(a) {
  const r = await openUrl(a);
  const el = document.createElement('a');
  el.href = r.url; el.download = a.name; el.click();
  setTimeout(r.revoke, 10000);
}
