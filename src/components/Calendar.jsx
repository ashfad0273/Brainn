import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/lib/icons';
import { useStore } from '../store';
import BrainShell, { PageHead } from './Shell';
import { Button } from './ui';
import { liveView } from '../lib/model';
import { isActive } from '../lib/meta';
import { cx } from '../lib/util';

/* A month of project deadlines and task due dates. Weeks start on Monday (Ume).
   On a phone the days show dots and the month's dates follow as a list. */

const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const { state } = useStore();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = iso(new Date());

  // Every dated thing, by day: a project's deadline, or an open task's due date.
  const byDay = useMemo(() => {
    const map = {};
    const add = (day, e) => { (map[day] ||= []).push(e); };
    state.projects.filter(p => !p.archived).map(liveView).forEach(p => {
      if (p.deadline && p.status !== 'cancelled') add(p.deadline, { id: p.id, title: `${p.name} due`, p, href: `#/p/${p.id}/chat`, deadline: true });
      p.items.filter(it => it.type === 'task' && isActive(it) && it.due).forEach(it => add(it.due, { id: it.id, title: it.title, p, href: `#/p/${p.id}/tasks/i/${it.id}` }));
    });
    return map;
  }, [state.projects]);

  // The grid: from the Monday on or before the 1st to the Sunday on or after the last day.
  const days = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((month.getDay() + 6) % 7));
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const end = new Date(last); end.setDate(last.getDate() + (6 - ((last.getDay() + 6) % 7)));
    const out = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) out.push(new Date(d));
    return out;
  }, [month]);

  const step = n => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));
  const inMonth = d => d.getMonth() === month.getMonth();
  const agenda = days.filter(inMonth).map(d => [d, byDay[iso(d)] || []]).filter(([, e]) => e.length);
  const title = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <BrainShell wide>
      <PageHead
        title={title}
        actions={<>
          <Button onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
          <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Previous month" title="Previous month"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Next month" title="Next month"><ChevronRight /></Button>
        </>}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEK.map(w => <div key={w} className="px-2 py-2.5 text-center text-label-mono text-muted-foreground sm:text-start sm:px-3">{w}</div>)}
        </div>
        <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-e-0">
          {days.map(d => {
            const key = iso(d), events = byDay[key] || [];
            return (
              <div key={key} className={cx('min-h-16 border-e border-b border-border p-1.5 sm:min-h-28 sm:p-2', !inMonth(d) && 'bg-muted')}>
                <span className={cx('grid size-7 place-items-center rounded-full text-xs tabular-nums', key === today ? 'bg-primary font-medium text-primary-foreground' : inMonth(d) ? 'text-foreground' : 'text-text-tertiary')}>{d.getDate()}</span>
                {/* phones: a dot per thing that day */}
                <div className="mt-1 flex flex-wrap gap-1 sm:hidden">{events.slice(0, 4).map(e => <span key={e.id} className="size-1.5 rounded-full" style={{ background: e.p.color }} />)}</div>
                <ul className="mt-1 hidden space-y-1 sm:block">
                  {events.slice(0, 3).map(e => (
                    <li key={e.id}>
                      <a href={e.href} title={`${e.title} · ${e.p.name}`} className={cx('flex items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-xs outline-none hover:bg-field-hover focus-visible:bg-field-hover', e.deadline && 'font-medium')}>
                        <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: e.p.color }} /><span className="truncate">{e.title}</span>
                      </a>
                    </li>
                  ))}
                  {events.length > 3 && <li className="px-1.5 text-xs text-muted-foreground">+{events.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* The month as a list: every date on a phone, and below the grid on larger screens too. */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <h2 className="border-b border-border px-5 py-4 font-medium">This month</h2>
        {agenda.length ? (
          <ul className="divide-y divide-border">
            {agenda.flatMap(([d, events]) => events.map(e => (
              <li key={e.id + iso(d)}>
                <a href={e.href} className="flex items-center gap-3 px-5 py-3 outline-none hover:bg-field-hover focus-visible:bg-field-hover">
                  <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: e.p.color }} />
                  <span className={cx('min-w-0 flex-1 truncate text-sm', e.deadline && 'font-medium')}>{e.title}</span>
                  <span className="truncate text-xs text-muted-foreground max-sm:hidden">{e.p.name}</span>
                </a>
              </li>
            )))}
          </ul>
        ) : <p className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing due this month. Deadlines and task due dates show up here.</p>}
      </div>
    </BrainShell>
  );
}
