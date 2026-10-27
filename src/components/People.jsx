import { useEffect, useMemo, useState } from 'react';
import { Moon, Sun, Sunset } from '@/lib/icons';
import { useStore } from '../store';
import { browserTz } from '../lib/api';
import { personNow, overlapWindows, fmtWindows, tzCity } from '../lib/time';
import { memberRole } from '../lib/meta';
import { activeMembers } from '../lib/model';
import { cx } from '../lib/util';

/** Re-render every `ms` so clocks stay current. */
export function useNow(ms = 30000) {
  const [, tick] = useState(0);
  useEffect(() => { const h = setInterval(() => tick(x => x + 1), ms); return () => clearInterval(h); }, [ms]);
}

/**
 * Time zones for the people in a project. `mine` is the viewer's: for the owner the organization's zone and
 * hours (Settings → Organization), for someone invited their own.
 */
export function useZones() {
  const { state, people, user, mode } = useStore();
  return useMemo(() => {
    const org = state?.settings.org || {};
    const byId = new Map((people || []).map(x => [x.id, x]));
    const ownerUser = (people || []).find(x => x.role === 'owner');
    const owner = { tz: org.tz || ownerUser?.tz || browserTz(), start: org.workStart || ownerUser?.workStart || '09:00', end: org.workEnd || ownerUser?.workEnd || '18:00' };
    const self = user && byId.get(user.id) || user;
    const mine = mode === 'member' ? { tz: self?.tz || browserTz(), start: self?.workStart || '09:00', end: self?.workEnd || '18:00' } : owner;
    const ofMember = m => { const u = m?.userId && byId.get(m.userId); return u?.tz ? { tz: u.tz, start: u.workStart || '09:00', end: u.workEnd || '18:00' } : null; };
    return { mine, owner, ofMember, person: id => byId.get(id) || null };
  }, [state?.settings.org, people, user, mode]);
}

const MOODS = {
  work: { icon: Sun, cls: 'text-pos', dot: 'bg-green', text: 'working hours' },
  evening: { icon: Sunset, cls: 'text-warn-ink', dot: 'bg-amber', text: 'outside working hours' },
  night: { icon: Moon, cls: 'text-muted-foreground', dot: 'bg-grey-400', text: 'probably asleep' },
};
function moodOf(now) {
  if (now.working) return MOODS.work;
  return now.min >= 22 * 60 || now.min < 7 * 60 ? MOODS.night : MOODS.evening;
}

/** "Sara · 11:42 PM Thu" with a coloured dot; the tooltip says when you overlap. */
export function ZoneChip({ name, zone, mine, compact }) {
  const now = personNow(zone);
  const mood = moodOf(now);
  const windows = overlapWindows(mine, zone);
  const same = mine.tz === zone.tz;
  const tip = `${name}: ${now.label} ${now.day} in ${tzCity(zone.tz)} (${mood.text}${now.weekend ? ', weekend' : ''}). Works ${zone.start}–${zone.end} their time.` +
    (same ? '' : windows.length ? ` Overlap with your hours: ${fmtWindows(windows)} your time.` : ' Your working hours don’t overlap — catch them early or late.');
  const Icon = mood.icon;
  return (
    <span title={tip} className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-field ring-1 ring-inset ring-border px-2 py-0.5 text-xs', mood.cls)}>
      <Icon size={11} />
      <span className="text-foreground">{name.split(' ')[0]}</span>
      <span className="tabular-nums">{now.label}</span>
      {!compact && <span className="text-muted-foreground">{now.day}</span>}
    </span>
  );
}

/** One line per person: their local time, and the hours that overlap with yours. */
export function ZoneLine({ name, sub, zone, mine }) {
  useNow();
  if (!zone) return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-1 min-w-0 truncate text-foreground">{name}{sub && <span className="text-text-tertiary"> · {sub}</span>}</span>
      <span className="text-xs text-text-tertiary">time zone unknown</span>
    </div>
  );
  const now = personNow(zone), mood = moodOf(now), windows = overlapWindows(mine, zone);
  const same = mine.tz === zone.tz;
  return (
    <div className="text-sm">
      <div className="flex items-center gap-2">
        <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', mood.dot)} />
        <span className="flex-1 min-w-0 truncate text-foreground">{name}{sub && <span className="text-muted-foreground"> · {sub}</span>}</span>
        <span className={cx('text-xs tabular-nums', mood.cls)}>{now.label}</span>
      </div>
      <div className="pl-3.5 text-xs text-muted-foreground leading-snug">
        {tzCity(zone.tz)} · {mood.text}{now.weekend ? ' (weekend)' : ''}
        {!same && <><br />{windows.length ? <>Best time to reach: <span className="text-foreground">{fmtWindows(windows)}</span> your time</> : 'No overlap with your hours'}</>}
      </div>
    </div>
  );
}

/** Clocks for everyone in a project chat except the viewer. */
export function ChatTimeBar({ p, me }) {
  useNow();
  const { mode, state } = useStore();
  const z = useZones();
  const list = [
    ...(mode === 'member' ? [{ key: 'owner', name: state.settings.ownerName || 'Owner', zone: z.owner }] : []),
    ...activeMembers(p).filter(m => m.id !== me?.id).map(m => ({ key: m.id, name: m.name, role: memberRole(m), zone: z.ofMember(m) })),
  ].filter(x => x.zone && x.zone.tz !== z.mine.tz);
  if (!list.length) return null;
  return <div className="flex items-center gap-1.5 overflow-x-auto">{list.map(x => <ZoneChip key={x.key} name={x.name} zone={x.zone} mine={z.mine} compact />)}</div>;
}
