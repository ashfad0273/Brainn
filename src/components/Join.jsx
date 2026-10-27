import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2Off, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { ProjectShell } from './ProjectShell';
import { ProjectAvatar } from './ProjectArt';
import { namesFor, liveItems } from '../lib/model';
import { memberRole } from '../lib/meta';
import { setBlobMember } from '../lib/blobs';
import { cx, clone } from '../lib/util';

/** What a member is allowed to see: never suggestions, the vault, internal notes or the log. */
function memberCopy(p, me) {
  const perms = me.perms || {};
  const allowed = { task: perms.tasks, requirement: perms.requirements, decision: perms.decisions, file: perms.files };
  return {
    ...p,
    items: liveItems(p).filter(i => allowed[i.type]).map(i => ({ ...i, notes: [], history: i.history.filter(h => h.action !== 'note' && h.action !== 'edit'), reading: undefined })),
    suggestions: [], asks: [], log: [],
    // members see each other by name and role only — never another member's link or PIN
    members: (p.members || []).map(m => ({ id: m.id, name: m.name, role: m.role, designation: m.designation, revokedAt: m.revokedAt, createdAt: m.createdAt })),
    summaries: perms.summary ? p.summaries.slice(-1) : [],
  };
}

function MemberPortal({ p, me, ownerName, mut }) {
  const [tab, setTab] = useState('chat');
  const perms = me.perms || {};
  const view = useMemo(() => memberCopy(p, me), [p, me]);
  const tabs = ['chat', perms.tasks && 'tasks', perms.requirements && 'requirements', perms.decisions && 'decisions', perms.files && 'files', perms.summary && 'memory'].filter(Boolean);
  const names = useMemo(() => namesFor(p, ownerName || 'Owner'), [p, ownerName]);
  const header = (
    <div className="min-w-0 flex-1 flex items-center gap-2.5 md:gap-3 pl-1.5">
      <ProjectAvatar p={p} className="w-8 h-8 md:w-9 md:h-9" rounded="rounded-full md:rounded-xl" />
      <div className="min-w-0">
        <div className="font-semibold truncate leading-tight">{p.name}</div>
        <div className="text-xs text-neutral-500 truncate">with {names.owner} · you're {me.name} ({memberRole(me)})</div>
      </div>
    </div>
  );
  return <ProjectShell p={view} role="client" me={me} names={names} tabs={tabs} tab={tab} setTab={setTab} header={header} searchProjects={[view]} mut={mut} />;
}

const Center = ({ children }) => <div className="h-full grid place-items-center text-center p-6">{children}</div>;

const Invalid = ({ text = 'It may have been replaced or revoked. Contact the project owner for a new link.' }) => (
  <Center>
    <div className="anim-pop max-w-sm">
      <Link2Off size={36} className="mx-auto text-neutral-600" />
      <h2 className="text-xl font-semibold mt-4">This invite link isn't valid</h2>
      <p className="text-neutral-500 text-sm mt-2">{text}</p>
    </div>
  </Center>
);

const Connecting = () => (
  <Center>
    <div className="anim-pop">
      <Loader2 size={32} className="mx-auto text-sky-400 animate-spin" />
      <p className="text-sm text-neutral-400 mt-3">Connecting to project…</p>
    </div>
  </Center>
);

/** onPin(pin) → null when accepted, otherwise the message to show. */
function PinScreen({ p, name, onPin }) {
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async v => {
    setPin(v);
    if (v.length !== 4 || busy) return;
    setBusy(true);
    const err = await onPin(v);
    setBusy(false);
    if (err) { setError(err); setBad(b => b + 1); setTimeout(() => setPin(''), 450); }
  };
  return (
    <Center>
      <div className="anim-pop">
        <ProjectAvatar p={p} className="w-14 h-14 mx-auto" rounded="rounded-2xl" text="text-xl" />
        <h2 className="text-2xl font-semibold mt-5">Hi {name.split(' ')[0]}</h2>
        <p className="text-neutral-500 text-sm mt-1">Enter your 4-digit PIN to open “{p.name}”.</p>
        <input key={bad} autoFocus inputMode="numeric" maxLength={4} value={pin} disabled={busy} onChange={e => check(e.target.value.replace(/\D/g, ''))}
          className={cx('mt-6 w-56 text-center text-4xl tracking-[.5em] bg-[#1a1a1a] ring-1 rounded-2xl py-3 outline-none focus:ring-sky-500', bad && pin.length === 4 ? 'ring-rose-500 shake' : 'ring-white/10')} />
        <div className="h-5 mt-2 text-sm text-rose-300">{bad > 0 && pin.length === 4 ? error : ''}</div>
      </div>
    </Center>
  );
}

/** The link was made in this browser profile: the record is already here. */
function LocalJoin({ token, p, me }) {
  const { state } = useStore();
  const [ok, setOk] = useState(() => { try { return sessionStorage.getItem('pb-join-' + token) === '1'; } catch { return false; } });
  if (!ok) {
    return <PinScreen p={p} name={me.name} onPin={async v => {
      if (v !== me.pin) return 'Wrong PIN, try again';
      try { sessionStorage.setItem('pb-join-' + token, '1'); } catch { /* private mode */ }
      setOk(true);
      return null;
    }} />;
  }
  return <MemberPortal p={p} me={me} ownerName={state.settings.ownerName} />;
}

/* ---------------- through the sync Worker (any browser) ---------------- */

function memberApi(base, token) {
  const call = async (path, { session, json, ...init } = {}) => {
    const headers = { ...(session ? { Authorization: 'Member ' + session } : {}), ...(json ? { 'Content-Type': 'application/json' } : {}) };
    const res = await fetch(`${base}/v1/join/${encodeURIComponent(token)}${path}`, { ...init, headers, ...(json ? { body: JSON.stringify(json) } : {}) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), { status: res.status, body });
    return body;
  };
  return {
    greet: () => call(''),
    login: pin => call('/session', { method: 'POST', json: { pin } }),
    project: session => call('/project', { session }),
    send: (session, m) => call('/msg', { method: 'POST', session, json: m }),
  };
}

const POLL_MS = 10000;

function RemoteJoin({ token, base }) {
  const { toast } = useStore();
  const api = useMemo(() => memberApi(base, token), [base, token]);
  const KEY = 'pb-join-s-' + token;
  const [phase, setPhase] = useState('loading'); // loading | pin | ready | invalid | offline
  const [greet, setGreet] = useState(null);
  const [session, setSession] = useState(() => { try { return sessionStorage.getItem(KEY); } catch { return null; } });
  const [data, setData] = useState(null); // { project, member, ownerName }
  const dataRef = useRef(data);
  dataRef.current = data;

  const toPin = useCallback(async () => {
    try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
    setSession(null);
    try { setGreet(await api.greet()); setPhase('pin'); }
    catch (e) { setPhase(e.status === 404 ? 'invalid' : 'offline'); }
  }, [api, KEY]);

  const refresh = useCallback(async s => {
    try { setData(await api.project(s)); setPhase('ready'); }
    catch (e) { if (e.status === 401 || e.status === 404) await toPin(); else if (!dataRef.current) setPhase('offline'); }
  }, [api, toPin]);

  useEffect(() => { if (session) refresh(session); else toPin(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // new messages from the owner and other members
  useEffect(() => {
    if (phase !== 'ready' || !session) return;
    const h = setInterval(() => refresh(session), POLL_MS);
    const f = () => refresh(session);
    window.addEventListener('focus', f);
    return () => { clearInterval(h); window.removeEventListener('focus', f); };
  }, [phase, session, refresh]);

  // attachments up/download through this member's session while the portal is open
  useEffect(() => {
    if (!session) return;
    setBlobMember({ base, token, session });
    return () => setBlobMember(null);
  }, [base, token, session]);

  const login = async pin => {
    try {
      const r = await api.login(pin);
      try { sessionStorage.setItem(KEY, r.session); } catch { /* private mode */ }
      setSession(r.session);
      setData({ project: r.project, member: r.member, ownerName: r.ownerName });
      setPhase('ready');
      return null;
    } catch (e) {
      if (e.status === 429) return `Too many wrong PINs — try again in ${Math.ceil((e.body?.retryAfter || 900) / 60)} min`;
      if (e.status === 401) return e.body?.triesLeft ? `Wrong PIN — ${e.body.triesLeft} ${e.body.triesLeft === 1 ? 'try' : 'tries'} left` : 'Wrong PIN, try again';
      if (e.status === 404) { setPhase('invalid'); return null; }
      return 'Could not reach the project — check your connection';
    }
  };

  /** A member can only add messages: apply the change to a copy, then send what's new to the server. */
  const mut = useCallback(fn => {
    const cur = dataRef.current;
    if (!cur) return;
    const draft = clone(cur.project);
    const known = new Set(draft.messages.map(m => m.id));
    fn(draft);
    const added = draft.messages.filter(m => !known.has(m.id));
    if (!added.length) return;
    setData(d => ({ ...d, project: draft }));
    (async () => {
      for (const m of added) {
        const r = await api.send(session, { id: m.id, text: m.text, attachments: m.attachments, voice: m.voice });
        setData(d => ({ ...d, project: r.project }));
      }
    })().catch(e => { toast('Message not sent: ' + e.message, 'error'); refresh(session); });
  }, [api, session, toast, refresh]);

  if (phase === 'loading') return <Connecting />;
  if (phase === 'invalid') return <Invalid />;
  if (phase === 'offline') return <Invalid text="The project server could not be reached. Check your connection and reload the page." />;
  if (phase === 'pin') return <PinScreen p={greet.project} name={greet.member.name} onPin={login} />;
  return <MemberPortal p={data.project} me={data.member} ownerName={data.ownerName} mut={mut} />;
}

export default function Join({ token }) {
  const { state } = useStore();
  for (const x of state?.projects || []) {
    const m = (x.members || []).find(y => y.token === token && !y.revokedAt);
    if (m) return <LocalJoin token={token} p={x} me={m} />;
  }
  const base = (state?.settings?.workerUrl || import.meta.env.VITE_WORKER_URL || '').replace(/\/+$/, '');
  if (!base) return <Invalid text="It was created in another browser and no project server is configured. Ask for a new link." />;
  return <RemoteJoin key={token} token={token} base={base} />;
}
