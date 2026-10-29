import { useMemo } from 'react';
import { Check } from '@/lib/icons';
import { useStore } from '../store';
import BrainShell, { Panel } from './Shell';
import { UnreadBadge, useProjectList } from './Rail';
import { ProjectAvatar } from './ProjectArt';
import { ProgressBar } from './Overview';
import { opLabel } from './Suggestions';
import { liveView, myMember, canReview, setStatus, projectProgress, timeLeftLabel, daysLeft } from '../lib/model';
import { isActive } from '../lib/meta';
import { cx, fmtRel } from '../lib/util';

/* The first page: what's new and what's waiting, across every project. Four
   panels with the same rows: rounded, no lines between them, the first five
   each, and the panel's count in its header. Each row opens what it's about. */

const SHOW = 5;
const row = 'flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none hover:bg-field-hover focus-visible:bg-field-hover';
const List = ({ children }) => <ul className="flex flex-col gap-0.5 p-2">{children}</ul>;
const None = ({ children }) => <p className="grid h-full min-h-32 place-items-center px-5 text-center text-sm text-muted-foreground">{children}</p>;
const Count = ({ n }) => (n ? <span className="text-sm text-muted-foreground tabular-nums">{n}</span> : null);

/* A soft pill for when something is due: red when late, amber when close, grey otherwise. */
const PILL = { late: 'bg-neg-soft text-neg-ink', soon: 'bg-warn-soft text-warn-ink', later: 'bg-field text-text-secondary' };
const Due = ({ tone, children }) => <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-xs', PILL[tone])}>{children}</span>;

// Days from today to an ISO date: negative when it has passed.
const daysTo = iso => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(y, m - 1, d) - t) / 86400000); };
const toneFor = n => (n < 0 ? 'late' : n <= 3 ? 'soon' : 'later');

// "Today", "Tomorrow", "In 3 days", "2 days late"
function dueText(n) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} late`;
  return `In ${n} days`;
}

export default function Dashboard() {
  const { state, mode, user, mutate } = useStore();
  const projects = useMemo(() => state.projects.filter(p => !p.archived).map(liveView), [state.projects]);

  // One row per conversation, latest first, with what was last said and what you haven't read.
  const conversations = useProjectList().filter(x => !x.p.archived && x.last).slice(0, SHOW);
  const allTasks = projects
    .flatMap(p => p.items.filter(it => it.type === 'task' && isActive(it)).map(it => ({ p, it })))
    .sort((a, b) => (a.it.due || '9999').localeCompare(b.it.due || '9999') || b.it.createdAt - a.it.createdAt);
  const tasks = allTasks.slice(0, SHOW), openTasks = allTasks.length;
  const review = projects
    .filter(p => canReview(mode === 'member' ? 'client' : 'owner', myMember(p, user)))
    .map(p => ({ p, list: p.suggestions.filter(s => s.state === 'pending') })).filter(x => x.list.length).slice(0, SHOW);
  const deadlines = projects.filter(p => p.deadline && p.status !== 'completed' && p.status !== 'cancelled').sort((a, b) => daysLeft(a) - daysLeft(b));

  const owner = mode !== 'member';
  const done = (p, id) => mutate(p.id, q => setStatus(q, 'owner', id, 'done'));

  return (
    <BrainShell>
      <div className="grid gap-5 sm:grid-cols-2">
        <Panel title="Messages" action={<Count n={conversations.reduce((n, x) => n + x.unread, 0)} />}>
          {conversations.length ? (
            <List>
              {conversations.map(({ p, unread, last, ts }) => (
                <li key={p.id}>
                  <a href={`#/p/${p.id}/chat`} className={row}>
                    <ProjectAvatar p={p} className="size-9" rounded="rounded-xl" text="text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={cx('min-w-0 flex-1 truncate text-sm', unread > 0 && 'font-medium')}>{p.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{fmtRel(ts)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={cx('min-w-0 flex-1 truncate text-sm', unread > 0 ? 'text-foreground' : 'text-text-secondary')}>{last}</span>
                        {unread > 0 && <UnreadBadge n={unread} />}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </List>
          ) : <None>No messages yet.</None>}
        </Panel>

        <Panel title="Tasks" action={<Count n={openTasks} />}>
          {tasks.length ? (
            <List>
              {tasks.map(({ p, it }) => {
                const n = it.due ? daysTo(it.due) : null;
                return (
                  <li key={it.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-field-hover">
                    {owner
                      ? <button type="button" onClick={() => done(p, it.id)} aria-label={`Mark “${it.title}” done`} title="Mark done" className="grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] border-border-strong text-transparent outline-none hover:border-green hover:text-green focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"><Check /></button>
                      : <span aria-hidden className="size-4.5 shrink-0 rounded-full border-[1.5px] border-border-strong" />}
                    <a href={`#/p/${p.id}/tasks/i/${it.id}`} className="flex min-w-0 flex-1 items-center gap-3 outline-none focus-visible:underline">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{it.title}</span>
                        <span className="flex items-center gap-1.5 text-xs text-text-secondary"><span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.name}</span></span>
                      </span>
                      {n !== null && <Due tone={toneFor(n)}>{dueText(n)}</Due>}
                    </a>
                  </li>
                );
              })}
            </List>
          ) : <None>No open tasks. Nice.</None>}
        </Panel>

        <Panel title="To review" action={<Count n={review.reduce((n, x) => n + x.list.length, 0)} />}>
          {review.length ? (
            <List>
              {review.map(({ p, list }) => (
                <li key={p.id}>
                  <a href={`#/p/${p.id}/chat`} className={row}>
                    <ProjectAvatar p={p} className="size-9" rounded="rounded-xl" text="text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="block truncate text-sm text-text-secondary">{opLabel(list[0])}: {list[0].title || 'see the chat'}</span>
                    </span>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-ink">{list.length} to review</span>
                  </a>
                </li>
              ))}
            </List>
          ) : <None>Nothing waiting for review.</None>}
        </Panel>

        <Panel title="Deadlines" href="#/calendar" action={<Count n={deadlines.length} />}>
          {deadlines.length ? (
            <List>
              {deadlines.slice(0, SHOW).map(p => {
                const n = daysLeft(p);
                const progress = projectProgress(p).value;
                return (
                  <li key={p.id}>
                    <a href={`#/p/${p.id}/chat`} className={row}>
                      <ProjectAvatar p={p} className="size-9" rounded="rounded-xl" text="text-sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{p.name}</span>
                        <span className="flex items-center gap-2 text-xs text-text-secondary"><ProgressBar value={progress} color={p.color} className="w-20" /><span className="tabular-nums">{progress}%</span></span>
                      </span>
                      <Due tone={toneFor(n)}>{timeLeftLabel(p)}</Due>
                    </a>
                  </li>
                );
              })}
            </List>
          ) : <None>No project deadlines set. Add one in a project's details.</None>}
        </Panel>
      </div>
    </BrainShell>
  );
}
