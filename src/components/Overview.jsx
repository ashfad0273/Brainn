import { useEffect, useState } from 'react';
import { CalendarClock, ListTodo, AlertTriangle, Sparkles, RotateCcw, X } from 'lucide-react';
import { useStore } from '../store';
import { useP, Button } from './ui';
import { ZoneLine, useZones } from './People';
import { updateMeta, projectProgress, timeLeftLabel, daysLeft, activeMembers, canReview } from '../lib/model';
import { PROJECT_STATUS, COLOR, isActive, memberRole } from '../lib/meta';
import { cx, isOverdue, fmtDue } from '../lib/util';

export function StatusPill({ status, className }) {
  const s = PROJECT_STATUS[status] || PROJECT_STATUS.in_progress;
  return <span className={cx('inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 ring-inset', COLOR[s.tone].badge, className)}><span className={cx('w-1.5 h-1.5 rounded-full', s.dot)} />{s.label}</span>;
}

export function ProgressBar({ value, color, className }) {
  return <div className={cx('h-1.5 bg-white/5 rounded-full overflow-hidden', className)}><div className="h-full rounded-full transition-all" style={{ width: Math.max(0, Math.min(100, value)) + '%', background: color || '#0ea5e9' }} /></div>;
}

/** Tone for "x days left". */
export function timeTone(p) {
  const n = daysLeft(p);
  if (p.status === 'completed' || p.status === 'cancelled' || n === null) return 'text-neutral-500';
  return n < 0 ? 'text-rose-300' : n <= 3 ? 'text-amber-300' : 'text-neutral-400';
}

/** Moves freely; saves once when let go (one history entry, not one per pixel). */
function ProgressSlider({ value, onCommit }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return <input type="range" min="0" max="100" step="5" value={v} aria-label="Set progress by hand" onChange={e => setV(Number(e.target.value))}
    onPointerUp={() => onCommit(v)} onKeyUp={() => onCommit(v)} onBlur={() => onCommit(v)} className="w-full mt-2 accent-sky-400" />;
}

const Label = ({ children }) => <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1.5">{children}</div>;

/** Right-hand panel in a project: status, progress, time remaining, who's in it and their local time. */
export default function ProjectOverview({ onClose }) {
  const { p, role, me, mut, names, openItem } = useP();
  const { state } = useStore();
  const z = useZones();
  const owner = role === 'owner';
  const prog = projectProgress(p);
  const tasks = p.items.filter(i => i.type === 'task');
  const open = tasks.filter(isActive);
  const overdue = open.filter(t => isOverdue(t.due));
  const pending = canReview(role, me) ? p.suggestions.filter(s => s.state === 'pending').length : 0;
  const set = (patch, action) => mut(q => updateMeta(q, 'owner', patch, action));
  const members = activeMembers(p);

  return (
    <div className="p-4 space-y-5">
      {onClose && <div className="flex justify-end -mb-3"><Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close"><X size={15} /></Button></div>}
      <div>
        <Label>Status</Label>
        {owner ? (
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(PROJECT_STATUS).map(([k, s]) => (
              <button key={k} onClick={() => p.status !== k && set({ status: k }, 'project.status')}
                className={cx('flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg ring-1 ring-inset transition', p.status === k ? cx(COLOR[s.tone].badge) : 'ring-white/[.06] text-neutral-500 hover:text-neutral-200 hover:bg-white/[.03]')}>
                <span className={cx('w-1.5 h-1.5 rounded-full', s.dot)} />{s.label}
              </button>
            ))}
          </div>
        ) : <StatusPill status={p.status} />}
      </div>

      <div>
        <div className="flex items-baseline justify-between"><Label>Progress</Label><span className="text-sm font-semibold tabular-nums">{prog.value}%</span></div>
        <ProgressBar value={prog.value} color={p.color} />
        <div className="text-[11px] text-neutral-500 mt-1.5 flex items-center gap-2">
          {prog.manual ? <>Set by hand · auto would be {prog.auto}%</> : <>From tasks done & requirements delivered</>}
          {owner && prog.manual && <button onClick={() => set({ progressOverride: null }, 'project.progress')} className="ml-auto flex items-center gap-1 text-sky-300 hover:underline"><RotateCcw size={11} />Auto</button>}
        </div>
        {owner && p.status !== 'completed' && <ProgressSlider value={prog.value} onCommit={v => v !== prog.value && set({ progressOverride: v }, 'project.progress')} />}
      </div>

      <div>
        <Label>Time remaining</Label>
        <div className={cx('text-sm font-medium flex items-center gap-2', timeTone(p))}><CalendarClock size={15} />{timeLeftLabel(p)}</div>
        {owner
          ? <input type="date" value={p.deadline || ''} onChange={e => set({ deadline: e.target.value }, 'project.deadline')} className="mt-2 w-full bg-[#111] ring-1 ring-inset ring-white/10 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-sky-500/70" />
          : p.deadline && <div className="text-xs text-neutral-500 mt-1">Deadline {fmtDue(p.deadline)}</div>}
        {owner && !p.deadline && <div className="text-xs text-amber-300 mt-1.5">No deadline yet — set one above.</div>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[.03] py-2"><div className="text-lg font-semibold tabular-nums">{open.length}</div><div className="text-[10px] text-neutral-500 flex items-center justify-center gap-1"><ListTodo size={10} />open</div></div>
        <div className="rounded-xl bg-white/[.03] py-2"><div className={cx('text-lg font-semibold tabular-nums', overdue.length && 'text-rose-300')}>{overdue.length}</div><div className="text-[10px] text-neutral-500 flex items-center justify-center gap-1"><AlertTriangle size={10} />overdue</div></div>
        <div className="rounded-xl bg-white/[.03] py-2"><div className={cx('text-lg font-semibold tabular-nums', pending && 'text-sky-300')}>{pending}</div><div className="text-[10px] text-neutral-500 flex items-center justify-center gap-1"><Sparkles size={10} />to review</div></div>
      </div>
      {overdue.length > 0 && (
        <div className="space-y-0.5 -mt-2">
          {overdue.slice(0, 4).map(t => <button key={t.id} onClick={() => openItem(t.id)} className="w-full text-left text-xs text-rose-300/90 truncate hover:underline">{t.title} · {fmtDue(t.due)}</button>)}
        </div>
      )}

      <div>
        <Label>People · {members.length + 1}</Label>
        <div className="space-y-2.5">
          <ZoneLine name={state.settings.ownerName || names.owner} sub="Owner" zone={z.owner} mine={z.mine} />
          {members.map(m => <ZoneLine key={m.id} name={m.name} sub={memberRole(m)} zone={z.ofMember(m)} mine={z.mine} />)}
          {!members.length && <div className="text-xs text-neutral-600">Nobody invited yet.</div>}
        </div>
      </div>
    </div>
  );
}
