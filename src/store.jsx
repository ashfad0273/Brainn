// Workspace state. Three modes:
//   local  – no server: loaded from IndexedDB (optionally AES-encrypted), demo workspace on first launch
//   owner  – the same local copy, plus pushes to / pulls from the sync server (pushes are merged there)
//   member – someone invited: the projects the server gives them, changes sent straight to the server
// Every mode offers the same context, so the views don't care which one they run in.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as kv from './lib/kv';
import * as vault from './lib/crypto';
import { setBlobKey, setBlobRemote, reencryptAll, isQuotaError } from './lib/blobs';
import { mergeState, normalizeState, normalizeProject, mergeProject, defaultSettings, hideDemoDuplicates, DEMO_IDS } from './lib/model';
import { withoutVault } from './lib/merge';
import { api } from './lib/api';
import { setServerAi } from './lib/gemini';
import { buildSeed, loadDemoApps } from './seed';
import { uid, clone, now } from './lib/util';
import { notify } from '@ume/ui/lib/toast';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const KEY = 'workspace';
const TAB = uid('tab');
const PULL_MS = 20000, MEMBER_PULL_MS = 10000, PEOPLE_MS = 60000;

// Toasts are Ume's (ToastProvider in main.jsx); `toasts` stays for the views that read it.
const NO_TOASTS = [];
function useToasts() {
  const toast = useCallback((text, tone = 'default') => {
    if (tone === 'error') notify.error(text);
    else notify.success(text);
  }, []);
  return { toasts: NO_TOASTS, toast };
}

/** Demo copies merged into one project show each message twice; hide the extra copies. */
function cleanDemo(s) {
  let changed = false;
  const projects = s.projects.map(p => {
    const q = clone(p);
    if (!hideDemoDuplicates(q)) return p;
    changed = true;
    return q;
  });
  return changed ? { ...s, projects } : s;
}

export function StoreProvider({ mode = 'local', user = null, ai = null, children }) {
  if (ai) setServerAi(ai);
  return mode === 'member' ? <MemberStore user={user}>{children}</MemberStore> : <LocalStore mode={mode} user={user}>{children}</LocalStore>;
}

/* ---------------- owner / local-only ---------------- */

function LocalStore({ mode, user, children }) {
  const synced = mode === 'owner';
  const [phase, setPhase] = useState('loading'); // loading | locked | ready | error
  const [state, setState] = useState(null);
  const [encrypted, setEncrypted] = useState(false);
  const [people, setPeople] = useState([]);
  const { toasts, toast } = useToasts();
  const keyRef = useRef(null), saltRef = useRef(null), lastJson = useRef(''), chan = useRef(null);
  const stateRef = useRef(null), phaseRef = useRef(phase);
  stateRef.current = state;
  phaseRef.current = phase;

  const lockOut = salt => { saltRef.current = salt; keyRef.current = null; setBlobKey(null); setState(null); setEncrypted(true); setPhase('locked'); };

  // initial load
  useEffect(() => {
    setBlobRemote(synced ? 'owner' : null);
    (async () => {
      try {
        const blob = await kv.get(KEY);
        // a signed-in owner starts empty and pulls from the server; only local-only mode gets the demo
        if (!blob) { setState(synced ? normalizeState({}) : buildSeed()); setPhase('ready'); return; }
        if (blob.enc) { lockOut(blob.salt); return; }
        let s = normalizeState(blob.data);
        lastJson.current = JSON.stringify(s);
        // a local demo workspace (it still has the first demo projects) picks up demo apps added since it was made
        const extra = !synced && s.projects.some(p => DEMO_IDS.includes(p.id)) && loadDemoApps(s);
        if (extra) s = mergeState(s, extra);
        setState(cleanDemo(s));
        setPhase('ready');
      } catch (e) {
        console.error(e);
        setPhase('error'); // never fall back to demo data here — that would overwrite the saved workspace
      }
    })();
  }, [synced]);

  const write = useCallback(async s => {
    const json = JSON.stringify(s);
    const blob = keyRef.current
      ? { v: 1, enc: true, ...(await vault.encryptJSON(keyRef.current, saltRef.current, json)) }
      : { v: 1, enc: false, data: s };
    await kv.set(KEY, blob);
    lastJson.current = json;
    chan.current?.postMessage({ type: 'saved', from: TAB });
  }, []);

  // save on change + push to the sync server
  useEffect(() => {
    if (phase !== 'ready' || !state) return;
    if (JSON.stringify(state) === lastJson.current) return;
    const h = setTimeout(() => {
      write(state).catch(e => toast(isQuotaError(e) ? 'Browser storage is full — the latest changes could not be saved. Free up space or export the workspace.' : 'Could not save: ' + e.message, 'error'));
      // The server merges this with what it has (member messages included); vault records and keys stay here.
      if (synced) {
        api('/v1/sync', {
          method: 'POST',
          json: {
            projects: state.projects.map(withoutVault),
            spaces: state.spaces,
            settings: { ...state.settings, apiKey: undefined, workerToken: undefined, workerUrl: undefined },
          },
        }).catch(e => console.warn('sync push', e.message)); // offline: the next change pushes everything again
      }
    }, 250);
    return () => clearTimeout(h);
  }, [state, phase, write, toast, synced]);

  // pull from the server periodically & on focus
  useEffect(() => {
    if (phase !== 'ready' || !synced) return;
    const pull = async () => {
      try {
        const remote = await api('/v1/sync');
        setState(cur => {
          if (!cur) return cur;
          const merged = mergeState(cur, { projects: remote.projects || [], spaces: remote.spaces || [], settings: remote.settings || {} });
          // the server never has the keys: keep this browser's, even when newer settings came in
          const { apiKey, workerUrl, workerToken } = cur.settings;
          return cleanDemo({ ...merged, settings: { ...merged.settings, apiKey, workerUrl, workerToken } });
        });
      } catch { /* offline */ }
    };
    pull();
    const timer = setInterval(pull, PULL_MS);
    window.addEventListener('focus', pull);
    return () => { clearInterval(timer); window.removeEventListener('focus', pull); };
  }, [phase, synced]);

  // everyone invited (names, labels, time zones)
  const refreshPeople = useCallback(async () => {
    if (!synced) return;
    try { setPeople((await api('/v1/people')).people); } catch { /* offline */ }
  }, [synced]);
  useEffect(() => {
    if (phase !== 'ready' || !synced) return;
    refreshPeople();
    const h = setInterval(refreshPeople, PEOPLE_MS);
    return () => clearInterval(h);
  }, [phase, synced, refreshPeople]);

  // other tabs saved → merge their copy into ours
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const c = new BroadcastChannel('project-brain');
    chan.current = c;
    c.onmessage = async ev => {
      if (ev.data?.from === TAB) return;
      try {
        const blob = await kv.get(KEY);
        if (!blob) return;
        if (blob.enc && !keyRef.current) { if (phaseRef.current === 'ready') lockOut(blob.salt); else saltRef.current = blob.salt; return; }
        let data;
        if (blob.enc) {
          try { data = await vault.decryptJSON(keyRef.current, blob); } catch { lockOut(blob.salt); return; }
        } else {
          if (keyRef.current) { keyRef.current = null; setBlobKey(null); setEncrypted(false); }
          data = blob.data;
        }
        if (phaseRef.current !== 'ready') return;
        const remote = normalizeState(data), rj = JSON.stringify(remote);
        setState(cur => {
          if (!cur) return remote;
          const merged = mergeState(cur, remote);
          if (JSON.stringify(merged) === rj) lastJson.current = rj;
          return merged;
        });
      } catch (e) { console.warn('sync', e); }
    };
    return () => c.close();
  }, []);

  /* ---- mutations ---- */
  const mutate = useCallback((pid, fn) => setState(s => {
    const i = s.projects.findIndex(p => p.id === pid);
    if (i < 0) return s;
    const p = clone(s.projects[i]);
    fn(p);
    const projects = s.projects.slice();
    projects[i] = p;
    return { ...s, projects };
  }), []);
  const update = useCallback(fn => setState(s => fn(clone(s))), []);
  const setSettings = useCallback(patch => setState(s => ({ ...s, settings: { ...s.settings, ...patch, settingsAt: now() } })), []);
  const importState = useCallback(obj => setState(s => mergeState(s, normalizeState(obj))), []);

  /* ---- encryption ---- */
  const unlock = useCallback(async pass => {
    const blob = await kv.get(KEY);
    const key = await vault.deriveKey(pass, blob.salt);
    const data = await vault.decryptJSON(key, blob); // throws on a wrong passphrase
    keyRef.current = key;
    setBlobKey(key);
    saltRef.current = blob.salt;
    const s = normalizeState(data);
    lastJson.current = JSON.stringify(s);
    setState(cleanDemo(s));
    setEncrypted(true);
    setPhase('ready');
  }, []);
  const enableEncryption = useCallback(async pass => {
    const salt = vault.newSalt(), old = keyRef.current;
    keyRef.current = await vault.deriveKey(pass, salt);
    setBlobKey(keyRef.current);
    saltRef.current = salt;
    setEncrypted(true);
    await reencryptAll(old);
    await write(stateRef.current);
  }, [write]);
  const disableEncryption = useCallback(async () => {
    const old = keyRef.current;
    keyRef.current = null;
    setBlobKey(null);
    saltRef.current = null;
    setEncrypted(false);
    if (old) await reencryptAll(old);
    await write(stateRef.current);
  }, [write]);
  const lock = useCallback(() => { if (keyRef.current) lockOut(saltRef.current); }, []);

  const value = useMemo(() => ({
    mode, user, people, refreshPeople,
    phase, state, stateRef, toasts, toast, mutate, update, setSettings, importState,
    encrypted, unlock, enableEncryption, disableEncryption, lock,
  }), [mode, user, people, refreshPeople, phase, state, toasts, toast, mutate, update, setSettings, importState, encrypted, unlock, enableEncryption, disableEncryption, lock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------- someone invited ---------------- */

/** What changed in a project copy after a mutation: what a member is allowed to send to the server. */
function diffProject(before, after) {
  const byId = a => new Map(a.map(x => [x.id, x]));
  const changed = (a, b) => { const m = byId(a); return b.filter(x => !m.has(x.id) || JSON.stringify(m.get(x.id)) !== JSON.stringify(x)); };
  const bm = byId(before.messages);
  const messages = after.messages.filter(m => !bm.has(m.id));
  const fresh = new Set(messages.map(m => m.id));
  // the server makes the file records and log entries for a new message itself
  const upload = new Set(after.items.filter(i => fresh.has(i.sourceMsg) && i.via === 'upload').map(i => i.id));
  const bl = byId(before.log);
  return {
    messages,
    folderOf: id => after.items.find(i => i.sourceMsg === id && i.folder)?.folder || '',
    analyzed: after.messages.filter(m => bm.has(m.id) && m.analyzed && !bm.get(m.id).analyzed).map(m => m.id),
    items: changed(before.items, after.items).filter(i => !upload.has(i.id)),
    suggestions: changed(before.suggestions, after.suggestions),
    log: after.log.filter(e => !bl.has(e.id) && !fresh.has(e.ref) && !upload.has(e.ref)),
  };
}

function MemberStore({ user, children }) {
  const [phase, setPhase] = useState('loading');
  const [state, setState] = useState(null);
  const [people, setPeople] = useState([]);
  const { toasts, toast } = useToasts();
  const stateRef = useRef(null);
  const pending = useRef(new Map()); // message id → project id, until the server confirms it
  stateRef.current = state;

  /** A project from the server, keeping any message of ours it hasn't stored yet. */
  const withPending = useCallback((server, local) => {
    const p = normalizeProject(server);
    if (!local) return p;
    const extra = local.messages.filter(m => pending.current.has(m.id) && !p.messages.some(x => x.id === m.id));
    return extra.length ? mergeProject(p, { id: p.id, metaAt: 0, messages: extra }) : p;
  }, []);

  const load = useCallback(async () => {
    try {
      const w = await api('/v1/m/workspace');
      setServerAi({ gemini: !!w.ai?.gemini });
      setPeople([...(w.owner ? [{ ...w.owner }] : []), ...w.people.filter(x => x.id !== w.owner?.id)]);
      setState(prev => {
        const d = defaultSettings();
        const settings = {
          ...d, ...(prev?.settings || {}),
          ownerName: w.ownerName, workspaceName: w.org.name, org: { ...d.org, ...w.org }, templates: w.templates,
          provider: w.ai.provider, model: w.ai.model, cfModel: w.ai.cfModel, autoAnalyze: w.ai.autoAnalyze,
        };
        const local = new Map((prev?.projects || []).map(p => [p.id, p]));
        return { version: 1, settings, spaces: [], projects: w.projects.map(p => withPending(p, local.get(p.id))) };
      });
      setPhase('ready');
    } catch (e) {
      if (e.status !== 401) { if (!stateRef.current) setPhase('error'); else console.warn('workspace', e.message); }
    }
  }, [withPending]);

  useEffect(() => {
    setBlobRemote('member');
    load();
    const h = setInterval(load, MEMBER_PULL_MS);
    window.addEventListener('focus', load);
    return () => { clearInterval(h); window.removeEventListener('focus', load); };
  }, [load]);

  const replaceProject = useCallback((pid, fn) => setState(s => s && ({ ...s, projects: s.projects.map(p => (p.id === pid ? fn(p) : p)) })), []);

  /** Apply the change here at once, then send what a member may change: new messages, and (reviewers) suggestion decisions. */
  const mutate = useCallback((pid, fn) => {
    const cur = stateRef.current?.projects.find(p => p.id === pid);
    if (!cur) return;
    const draft = clone(cur);
    fn(draft);
    const d = diffProject(cur, draft);
    d.messages.forEach(m => pending.current.set(m.id, pid));
    replaceProject(pid, () => draft);
    (async () => {
      for (const m of d.messages) {
        const r = await api(`/v1/m/projects/${pid}/msg`, { method: 'POST', json: { id: m.id, text: m.text, attachments: m.attachments, voice: m.voice, replyTo: m.replyTo, folder: d.folderOf(m.id) } });
        pending.current.delete(m.id);
        replaceProject(pid, p => withPending(r.project, p));
      }
      if (d.items.length || d.suggestions.length || d.log.length || d.analyzed.length) {
        const r = await api(`/v1/m/projects/${pid}/apply`, { method: 'POST', json: { items: d.items, suggestions: d.suggestions, log: d.log, analyzed: d.analyzed } });
        replaceProject(pid, p => withPending(r.project, p));
      }
    })().catch(e => {
      d.messages.forEach(m => pending.current.delete(m.id));
      toast('Not saved: ' + e.message, 'error');
      load();
    });
  }, [replaceProject, withPending, toast, load]);

  const noop = useCallback(() => {}, []);
  const setSettings = useCallback(patch => setState(s => s && ({ ...s, settings: { ...s.settings, ...patch } })), []);

  const value = useMemo(() => ({
    mode: 'member', user, people, refreshPeople: load,
    phase, state, stateRef, toasts, toast, mutate, update: noop, setSettings, importState: noop,
    encrypted: false, unlock: noop, enableEncryption: noop, disableEncryption: noop, lock: noop,
  }), [user, people, load, phase, state, toasts, toast, mutate, noop, setSettings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
