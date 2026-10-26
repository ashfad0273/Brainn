import { useMemo, useState } from 'react';
import { Link2Off } from 'lucide-react';
import { useStore } from '../store';
import { ProjectShell } from './ProjectShell';
import { ProjectAvatar } from './ProjectArt';
import { namesFor, liveItems } from '../lib/model';
import { memberRole } from '../lib/meta';
import { cx } from '../lib/util';

/** What a member is allowed to see: never suggestions, the vault, internal notes or the log. */
function memberCopy(p, me) {
  const perms = me.perms || {};
  const allowed = { task: perms.tasks, requirement: perms.requirements, decision: perms.decisions, file: perms.files };
  return {
    ...p,
    items: liveItems(p).filter(i => allowed[i.type]).map(i => ({ ...i, notes: [], history: i.history.filter(h => h.action !== 'note' && h.action !== 'edit'), reading: undefined })),
    suggestions: [], asks: [], log: [],
    // members see each other by name and role only — never another member's link or PIN
    members: p.members.map(m => ({ id: m.id, name: m.name, role: m.role, designation: m.designation, revokedAt: m.revokedAt, createdAt: m.createdAt })),
    summaries: perms.summary ? p.summaries.slice(-1) : [],
  };
}

function MemberPortal({ p, me }) {
  const { state } = useStore();
  const [tab, setTab] = useState('chat');
  const perms = me.perms || {};
  const view = useMemo(() => memberCopy(p, me), [p, me]);
  const tabs = ['chat', perms.tasks && 'tasks', perms.requirements && 'requirements', perms.decisions && 'decisions', perms.files && 'files', perms.summary && 'memory'].filter(Boolean);
  const names = useMemo(() => namesFor(p, state.settings.ownerName || 'Owner'), [p, state.settings.ownerName]);
  const header = (
    <div className="min-w-0 flex-1 flex items-center gap-2.5 md:gap-3 pl-1.5">
      <ProjectAvatar p={p} className="w-8 h-8 md:w-9 md:h-9" rounded="rounded-full md:rounded-xl" />
      <div className="min-w-0">
        <div className="font-semibold truncate leading-tight">{p.name}</div>
        <div className="text-xs text-neutral-500 truncate">with {names.owner} · you're {me.name} ({memberRole(me)})</div>
      </div>
    </div>
  );
  return <ProjectShell p={view} role="client" me={me} names={names} tabs={tabs} tab={tab} setTab={setTab} header={header} searchProjects={[view]} />;
}

export default function Join({ token }) {
  const { state } = useStore();
  let p = null, me = null;
  for (const x of state.projects) {
    const m = (x.members || []).find(y => y.token === token && !y.revokedAt);
    if (m) { p = x; me = m; break; }
  }
  const [ok, setOk] = useState(() => { try { return sessionStorage.getItem('pb-join-' + token) === '1'; } catch { return false; } });
  const [pin, setPin] = useState('');
  const [bad, setBad] = useState(0);

  if (!p) {
    return (
      <div className="h-full grid place-items-center text-center p-6">
        <div className="anim-pop max-w-sm">
          <Link2Off size={36} className="mx-auto text-neutral-600" />
          <h2 className="text-xl font-semibold mt-4">This invite link isn't valid</h2>
          <p className="text-neutral-500 text-sm mt-2">It may have been replaced or revoked, or it was created in another browser. Ask for a new link.</p>
        </div>
      </div>
    );
  }
  const check = v => {
    setPin(v);
    if (v.length !== 4) return;
    if (v === me.pin) { try { sessionStorage.setItem('pb-join-' + token, '1'); } catch { /* private mode */ } setOk(true); }
    else { setBad(b => b + 1); setTimeout(() => setPin(''), 450); }
  };
  if (!ok) {
    return (
      <div className="h-full grid place-items-center p-6">
        <div className="text-center anim-pop">
          <ProjectAvatar p={p} className="w-14 h-14 mx-auto" rounded="rounded-2xl" text="text-xl" />
          <h2 className="text-2xl font-semibold mt-5">Hi {me.name.split(' ')[0]}</h2>
          <p className="text-neutral-500 text-sm mt-1">Enter your 4-digit PIN to open “{p.name}”.</p>
          <input key={bad} autoFocus inputMode="numeric" maxLength={4} value={pin} onChange={e => check(e.target.value.replace(/\D/g, ''))}
            className={cx('mt-6 w-56 text-center text-4xl tracking-[.5em] bg-[#1a1a1a] ring-1 rounded-2xl py-3 outline-none focus:ring-sky-500', bad && pin.length === 4 ? 'ring-rose-500 shake' : 'ring-white/10')} />
          <div className="h-5 mt-2 text-sm text-rose-300">{bad > 0 && pin.length === 4 ? 'Wrong PIN, try again' : ''}</div>
        </div>
      </div>
    );
  }
  return <MemberPortal p={p} me={me} />;
}
