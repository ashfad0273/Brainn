import { useMemo } from 'react';
import { Calendar, ListTodo, MessageSquare, Sparkles } from '@/lib/icons';
import { useStore } from '../store';
import BrainShell, { Panel } from './Shell';
import { ProjectAvatar } from './ProjectArt';
import { timeTone } from './Overview';
import { liveView, namesFor, secretValues, maskText, myMember, canReview, timeLeftLabel, daysLeft } from '../lib/model';
import { isActive } from '../lib/meta';
import { cx, fmtRel } from '../lib/util';

/* The first page: what's new and what's waiting, across every project, in the
   same cards as the Projects page. Each row opens the record it's about. */

const row = 'flex items-start gap-3 px-5 py-3 outline-none hover:bg-field-hover focus-visible:bg-field-hover';
const None = ({ children }) => <p className="grid h-full place-items-center px-5 text-center text-sm text-muted-foreground">{children}</p>;

// "Due today", "Due in 3 days", "3 days overdue"
function dueLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const n = Math.round((new Date(y, m - 1, d) - today) / 86400000);
  if (n === 0) return ['Due today', 'text-warn-ink'];
  if (n < 0) return [`${-n} day${n === -1 ? '' : 's'} overdue`, 'text-destructive-foreground'];
  return [`Due in ${n} day${n === 1 ? '' : 's'}`, n <= 3 ? 'text-warn-ink' : 'text-muted-foreground'];
}

export default function Dashboard() {
  const { state, mode, user } = useStore();
  const ownerName = state.settings.ownerName || 'You';
  const projects = useMemo(() => state.projects.filter(p => !p.archived).map(liveView), [state.projects]);

  const messages = projects
    .flatMap(p => { const names = namesFor(p, ownerName), secrets = secretValues(p); return p.messages.slice(-8).map(m => ({ p, m, who: names.msg(m), secrets })); })
    .sort((a, b) => b.m.ts - a.m.ts).slice(0, 8);
  const tasks = projects
    .flatMap(p => p.items.filter(it => it.type === 'task' && isActive(it)).map(it => ({ p, it })))
    .sort((a, b) => (a.it.due || '9999').localeCompare(b.it.due || '9999') || b.it.createdAt - a.it.createdAt).slice(0, 8);
  const review = projects
    .filter(p => canReview(mode === 'member' ? 'client' : 'owner', myMember(p, user)))
    .map(p => ({ p, n: p.suggestions.filter(s => s.state === 'pending').length })).filter(x => x.n);
  const deadlines = projects.filter(p => p.deadline && p.status !== 'completed' && p.status !== 'cancelled').sort((a, b) => daysLeft(a) - daysLeft(b));

  return (
    <BrainShell>
      <div className="grid gap-5 sm:grid-cols-2">
        <Panel title="Messages" icon={MessageSquare} className="h-96" bodyClassName="overflow-y-auto thin-scrollbar autohide-scrollbar">
          {messages.length ? (
            <ul className="divide-y divide-border">
              {messages.map(({ p, m, who, secrets }) => (
                <li key={m.id}>
                  <a href={`#/p/${p.id}/chat/m/${m.id}`} className={row}>
                    <ProjectAvatar p={p} className="size-7" rounded="rounded-lg" text="text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2"><span className="truncate font-medium text-sm">{who}</span><span className="truncate text-xs text-muted-foreground">{p.name}</span><span className="ms-auto shrink-0 text-xs text-muted-foreground">{fmtRel(m.ts)}</span></span>
                      <span className="line-clamp-1 text-sm text-text-secondary">{maskText(m.text, secrets).replace(/\*\*|~~|`/g, '') || m.attachments.map(a => a.name).join(', ') || 'Voice note'}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <None>No messages yet.</None>}
        </Panel>

        <Panel title="Tasks" icon={ListTodo} className="h-96" bodyClassName="overflow-y-auto thin-scrollbar autohide-scrollbar">
          {tasks.length ? (
            <ul className="divide-y divide-border">
              {tasks.map(({ p, it }) => {
                const [due, tone] = it.due ? dueLabel(it.due) : ['No due date', 'text-muted-foreground'];
                return (
                  <li key={it.id}>
                    <a href={`#/p/${p.id}/tasks/i/${it.id}`} className={row}>
                      <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{it.title}</span>
                        <span className="flex gap-2 text-xs"><span className="truncate text-muted-foreground">{p.name}</span><span className={cx('ms-auto shrink-0', tone)}>{due}</span></span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : <None>No open tasks. Nice.</None>}
        </Panel>

        <Panel title="To review" icon={Sparkles} className="h-96" bodyClassName="overflow-y-auto thin-scrollbar autohide-scrollbar">
          {review.length ? (
            <ul className="divide-y divide-border">
              {review.map(({ p, n }) => (
                <li key={p.id}>
                  <a href={`#/p/${p.id}/chat`} className={cx(row, 'items-center')}>
                    <ProjectAvatar p={p} className="size-7" rounded="rounded-lg" text="text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className="shrink-0 text-xs text-primary">{n} suggestion{n === 1 ? '' : 's'}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <None>Nothing waiting for review.</None>}
        </Panel>

        <Panel title="Deadlines" href="#/calendar" icon={Calendar} className="h-96" bodyClassName="overflow-y-auto thin-scrollbar autohide-scrollbar">
          {deadlines.length ? (
            <ul className="divide-y divide-border">
              {deadlines.map(p => (
                <li key={p.id}>
                  <a href={`#/p/${p.id}/chat`} className={cx(row, 'items-center')}>
                    <ProjectAvatar p={p} className="size-7" rounded="rounded-lg" text="text-xs" />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                    <span className={cx('shrink-0 text-xs', timeTone(p))}>{timeLeftLabel(p)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <None>No project deadlines set. Add one in a project's details.</None>}
        </Panel>
      </div>
    </BrainShell>
  );
}
