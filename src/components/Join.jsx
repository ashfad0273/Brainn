import { useMemo, useState } from 'react';
import { Link2Off } from 'lucide-react';
import { useStore } from '../store';
import { ProjectShell } from './ProjectShell';
import { cx } from '../lib/util';

/** What a client is allowed to see: never suggestions, the vault, internal notes or the log. */
function clientCopy(p) {
  const perms = p.invite.perms || {};
  const allowed = { task: perms.tasks, requirement: perms.requirements, decision: perms.decisions, file: perms.files };
  return {
    ...p,
    items: p.items.filter(i => allowed[i.type]).map(i => ({ ...i, notes: [], history: i.history.filter(h => h.action !== 'note' && h.action !== 'edit') })),
    suggestions: [], asks: [], log: [],
    summaries: perms.summary ? p.summaries.slice(-1) : [],
  };
}

function ClientPortal({ p }) {
  const { state } = useStore();
  const [tab, setTab] = useState('chat');
  const perms = p.invite.perms || {};
  const view = useMemo(() => clientCopy(p), [p]);
  const tabs = ['chat', perms.tasks && 'tasks', perms.requirements && 'requirements', perms.decisions && 'decisions', perms.files && 'files', perms.summary && 'memory'].filter(Boolean);
  const names = useMemo(() => ({ owner: state.settings.ownerName || 'Owner', client: p.invite.name }), [state.settings.ownerName, p.invite.name]);
  const header = (
    <div className="min-w-0 flex-1 flex items-center gap-3">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
      <div className="min-w-0">
        <div className="font-semibold truncate leading-tight">{p.name}</div>
        <div className="text-xs text-neutral-500 truncate">with {names.owner} · you're {p.invite.name}</div>
      </div>
    </div>
  );
  return <ProjectShell p={view} role="client" names={names} tabs={tabs} tab={tab} setTab={setTab} header={header} searchProjects={[view]} />;
}

export default function Join({ token }) {
  const { state } = useStore();
  const p = state.projects.find(x => x.invite?.token === token);
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
    if (v === p.invite.pin) { try { sessionStorage.setItem('pb-join-' + token, '1'); } catch { /* private mode */ } setOk(true); }
    else { setBad(b => b + 1); setTimeout(() => setPin(''), 450); }
  };
  if (!ok) {
    return (
      <div className="h-full grid place-items-center p-6">
        <div className="text-center anim-pop">
          <div className="w-14 h-14 rounded-2xl mx-auto grid place-items-center bg-white text-neutral-900 text-xl font-bold">{p.invite.name[0]}</div>
          <h2 className="text-2xl font-semibold mt-5">Hi {p.invite.name.split(' ')[0]}</h2>
          <p className="text-neutral-500 text-sm mt-1">Enter your 4-digit PIN to open “{p.name}”.</p>
          <input key={bad} autoFocus inputMode="numeric" maxLength={4} value={pin} onChange={e => check(e.target.value.replace(/\D/g, ''))}
            className={cx('mt-6 w-56 text-center text-4xl tracking-[.5em] bg-[#1a1a1a] ring-1 rounded-2xl py-3 outline-none focus:ring-sky-500', bad && pin.length === 4 ? 'ring-rose-500 shake' : 'ring-white/10')} />
          <div className="h-5 mt-2 text-sm text-rose-300">{bad > 0 && pin.length === 4 ? 'Wrong PIN, try again' : ''}</div>
        </div>
      </div>
    );
  }
  return <ClientPortal p={p} />;
}
