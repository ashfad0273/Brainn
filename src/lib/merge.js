// Merging two copies of one project record. Because the record is append-only, two copies can always
// be merged without losing anything. No imports on purpose: the Cloudflare Worker (worker/src/index.js)
// bundles this file too, so the browser tabs and the server merge exactly the same way.

export const byKey = k => (a, b) => ((a[k] || 0) - (b[k] || 0)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export function union(a, b, pick, sortKey) {
  const m = new Map(a.map(x => [x.id, x]));
  for (const y of b) { const x = m.get(y.id); m.set(y.id, x ? pick(x, y) : y); }
  return [...m.values()].sort(byKey(sortKey));
}
export const newer = (x, y) => ((y.updatedAt || 0) > (x.updatedAt || 0) ? y : x);
const first = x => x;
/** A tombstone always wins, so a deleted item never comes back from a tab that hadn't seen the delete. */
const tombstoneFirst = (x, y) => (x.deleted && !y.deleted ? x : y.deleted && !x.deleted ? y : newer(x, y));
/** A decision on a suggestion beats "pending"; otherwise the newer copy wins. */
const decided = (x, y) => (x.state === 'pending' && y.state !== 'pending' ? y : y.state === 'pending' && x.state !== 'pending' ? x : newer(x, y));
/** A hidden (tombstoned) message stays hidden; otherwise the analysed copy wins. */
const messagePick = (x, y) => (x.deleted && !y.deleted ? x : y.deleted && !x.deleted ? y : x.analyzed ? x : y);
const META = ['name', 'client', 'description', 'color', 'spaceId', 'archived', 'cover', 'avatar', 'status', 'deadline', 'progressOverride', 'fileFolders', 'metaAt'];
const LISTS = ['members', 'messages', 'items', 'suggestions', 'summaries', 'asks', 'log'];

/** Fill in missing lists so a partial copy (e.g. a member's message) can be merged. */
export const withLists = p => ({ ...Object.fromEntries(LISTS.map(k => [k, []])), ...p, ...Object.fromEntries(LISTS.map(k => [k, Array.isArray(p[k]) ? p[k] : []])) });

/** The copy that may leave this browser for the sync server: the vault (sensitive records and
 *  suggestions about them) stays local. Merging it back in later loses nothing, since union keeps local items. */
export function withoutVault(p) {
  p = withLists(p);
  const vault = new Set(p.items.filter(i => i.type === 'sensitive').map(i => i.id));
  return {
    ...p,
    items: p.items.filter(i => !vault.has(i.id)),
    suggestions: p.suggestions.filter(s => s.type !== 'sensitive' && !(s.targetId && vault.has(s.targetId))),
  };
}

export function mergeProject(a, b) {
  a = withLists(a); b = withLists(b);
  const src = (b.metaAt || 0) > (a.metaAt || 0) ? b : a;
  const out = { ...a };
  META.forEach(k => { out[k] = src[k]; });
  out.members = union(a.members, b.members, newer, 'createdAt');
  out.messages = union(a.messages, b.messages, messagePick, 'ts');
  out.items = union(a.items, b.items, tombstoneFirst, 'createdAt');
  out.suggestions = union(a.suggestions, b.suggestions, decided, 'ts');
  out.summaries = union(a.summaries, b.summaries, first, 'ts');
  out.asks = union(a.asks, b.asks, first, 'ts');
  out.log = union(a.log, b.log, first, 'ts');
  return out;
}

