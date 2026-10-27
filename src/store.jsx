// Workspace state: loaded from IndexedDB (optionally AES-encrypted), saved on every change,
// and synced between tabs (owner tab ↔ client tab) by merging the append-only records.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as kv from './lib/kv';
import * as vault from './lib/crypto';
import { setBlobKey, setBlobRemote, reencryptAll, isQuotaError } from './lib/blobs';
import { mergeState, normalizeState } from './lib/model';
import { withoutVault } from './lib/merge';
import { buildSeed } from './seed';
import { uid, clone, now } from './lib/util';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const KEY = 'workspace';
const TAB = uid('tab');

export function StoreProvider({ children }) {
  const [phase, setPhase] = useState('loading'); // loading | locked | ready | error
  const [state, setState] = useState(null);
  const [encrypted, setEncrypted] = useState(false);
  const [toasts, setToasts] = useState([]);
  const keyRef = useRef(null), saltRef = useRef(null), lastJson = useRef(''), chan = useRef(null);
  const stateRef = useRef(null), phaseRef = useRef(phase);
  stateRef.current = state;
  phaseRef.current = phase;

  const toast = useCallback((text, tone = 'default') => {
    const id = uid();
    setToasts(t => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);

  const lockOut = salt => { saltRef.current = salt; keyRef.current = null; setBlobKey(null); setState(null); setEncrypted(true); setPhase('locked'); };

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const blob = await kv.get(KEY);
        if (!blob) { setState(buildSeed()); setPhase('ready'); return; }
        if (blob.enc) { lockOut(blob.salt); return; }
        const s = normalizeState(blob.data);
        lastJson.current = JSON.stringify(s);
        setState(s);
        setPhase('ready');
      } catch (e) {
        console.error(e);
        setPhase('error'); // never fall back to demo data here — that would overwrite the saved workspace
      }
    })();
  }, []);

  const write = useCallback(async s => {
    const json = JSON.stringify(s);
    const blob = keyRef.current
      ? { v: 1, enc: true, ...(await vault.encryptJSON(keyRef.current, saltRef.current, json)) }
      : { v: 1, enc: false, data: s };
    await kv.set(KEY, blob);
    lastJson.current = json;
    chan.current?.postMessage({ type: 'saved', from: TAB });
  }, []);

  // save on change + push to the sync Worker if configured
  useEffect(() => {
    if (phase !== 'ready' || !state) return;
    setBlobRemote({ workerUrl: state.settings?.workerUrl, workerToken: state.settings?.workerToken });
    if (JSON.stringify(state) === lastJson.current) return;
    const h = setTimeout(() => {
      write(state).catch(e => toast(isQuotaError(e) ? 'Browser storage is full — the latest changes could not be saved. Free up space or export the workspace.' : 'Could not save: ' + e.message, 'error'));
      // Push to the sync Worker. The server merges it with what it has (member messages included);
      // vault records and keys stay in this browser.
      const { workerUrl, workerToken } = state.settings || {};
      if (workerUrl && workerToken) {
        fetch(workerUrl.replace(/\/+$/, '') + '/v1/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workerToken.trim()}` },
          body: JSON.stringify({
            projects: state.projects.map(withoutVault),
            spaces: state.spaces,
            settings: { ...state.settings, apiKey: undefined, workerToken: undefined },
          }),
        }).then(res => { if (!res.ok) console.warn('sync push', res.status); }).catch(() => { /* offline: the next change pushes everything again */ });
      }
    }, 250);
    return () => clearTimeout(h);
  }, [state, phase, write, toast]);

  // pull from the sync Worker periodically & on focus
  useEffect(() => {
    if (phase !== 'ready' || !state?.settings?.workerUrl || !state?.settings?.workerToken) return;
    const pull = async () => {
      const { workerUrl, workerToken } = stateRef.current?.settings || {};
      if (!workerUrl || !workerToken) return;
      try {
        const res = await fetch(workerUrl.replace(/\/+$/, '') + '/v1/sync', {
          headers: { Authorization: `Bearer ${workerToken.trim()}` },
        });
        if (!res.ok) return;
        const remote = await res.json();
        if (remote.projects || remote.spaces) {
          setState(cur => {
            if (!cur) return cur;
            const merged = mergeState(cur, {
              projects: remote.projects || [],
              spaces: remote.spaces || [],
              settings: remote.settings || {},
            });
            // the server never has the keys: keep this browser's, even when newer settings came in
            const { apiKey, workerUrl, workerToken } = cur.settings;
            return { ...merged, settings: { ...merged.settings, apiKey, workerUrl, workerToken } };
          });
        }
      } catch { /* offline */ }
    };
    pull();
    const timer = setInterval(pull, 20000);
    window.addEventListener('focus', pull);
    return () => { clearInterval(timer); window.removeEventListener('focus', pull); };
  }, [phase, state?.settings?.workerUrl, state?.settings?.workerToken]);

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
    setState(s);
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
    phase, state, stateRef, toasts, toast, mutate, update, setSettings, importState,
    encrypted, unlock, enableEncryption, disableEncryption, lock,
  }), [phase, state, toasts, toast, mutate, update, setSettings, importState, encrypted, unlock, enableEncryption, disableEncryption, lock]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
