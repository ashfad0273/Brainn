import { useSyncExternalStore } from 'react';

/* When this person last caught up on each project's chat, kept on this device
   only. It drives the unread counts in the rail and the Projects list. */

const KEY = 'brainn-seen';
const subs = new Set();
let cache = null;

const read = () => {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { cache = {}; }
  return cache;
};

/** Caught up on a project, through its latest message (which can carry a later clock than ours). */
export function markSeen(id, latest = 0) {
  cache = { ...read(), [id]: Math.max(Date.now(), latest) };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* private window: counts reset next visit */ }
  subs.forEach(f => f());
}

export const useSeen = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, read);

/** Messages from others since you last looked or last replied, whichever is later. */
export function unreadCount(p, seenAt = 0, mine = m => m.from === 'owner') {
  let n = 0;
  for (let i = p.messages.length - 1; i >= 0; i--) {
    const m = p.messages[i];
    if (mine(m) || m.ts <= seenAt) break;
    n++;
  }
  return n;
}
