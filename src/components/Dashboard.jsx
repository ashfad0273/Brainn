import { useMemo } from 'react';
import { Check } from '@/lib/icons';
import { InitialsAvatar } from '@ume/ui/components/patterns/IconChip';
import { useStore } from '../store';
import BrainShell, { Panel } from './Shell';
import { useProjectList } from './Rail';
import { ProjectAvatar } from './ProjectArt';
import { liveView, myMember, canReview, setStatus, daysLeft } from '../lib/model';
import { isActive } from '../lib/meta';
import { cx, fmtRel } from '../lib/util';

/* The first page: what's new and what's waiting, across every project, as a
   bento grid where each widget is shaped by what it holds: deadlines on a
   timeline, a big number to review, tasks by when they're due, and the latest
   line of each conversation as a chat bubble. Picked from
   design/dashboard-variations (A · Bento). */

const None = ({ children }) => <p className="grid h-full min-h-32 place-items-center px-5 text-center text-sm text-muted-foreground">{children}</p>;
const Count = ({ n }) => (n ? <span className="text-sm text-muted-foreground tabular-nums">{n}</span> : null);
const tone = n => (n < 0 ? 'bg-neg-soft text-neg-ink' : n <= 3 ? 'bg-warn-soft text-warn-ink' : 'bg-field text-text-secondary');

// Days from today to an ISO date: negative when it has passed.
const daysTo = iso => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((new Date(y, m - 1, d) - t) / 86400000); };

/* Each project pinned at its deadline on a line from a week ago to a month out (wider if a
   deadline falls outside), alternating above and below. Late ones sit on the red side of
   Today; a pin near an edge hangs its label inward. Phones keep the avatar and the days. */
function Timeline({ projects }) {
  const items = projects.map(p => ({ p, n: daysLeft(p) }));
  const lo = Math.min(-7, ...items.map(x => x.n - 2)), hi = Math.max(21, ...items.map(x => x.n + 4));
  const at = n => Math.max(4, Math.min(96, ((n - lo) / (hi - lo)) * 100));
  const weeks = [];
  for (let w = 7; w < hi; w += 7) weeks.push(w);
  return (
    <div className="relative mx-5 mt-2 mb-6 h-44">
      <div className="absolute inset-x-0 top-1/2 h-0.5 rounded-full bg-field" />
      <div className="absolute start-0 top-1/2 h-0.5 rounded-full bg-rose/50" style={{ width: `${at(0)}%` }} />
      {weeks.map(w => (
        <div key={w} className="absolute top-1/2 -mt-1 h-2 w-px bg-border-strong" style={{ left: `${at(w)}%` }}>
          <span className="absolute top-3 left-0 -translate-x-1/2 text-xs text-text-tertiary">{w / 7}w</span>
        </div>
      ))}
      <div className="absolute inset-y-3 border-s-[1.5px] border-dashed border-border-strong" style={{ left: `${at(0)}%` }}>
        <span className="absolute -bottom-3 left-0 -translate-x-1/2 text-xs text-text-secondary">Today</span>
      </div>
      {items.map(({ p, n }, i) => {
        const up = i % 2 === 0, x = at(n);
        return (
          <a key={p.id} href={`#/p/${p.id}/chat`} title={`${p.name}: ${n < 0 ? `${-n} days late` : `${n} days left`}`}
            className={cx('group absolute flex w-0 items-center gap-1 outline-none', up ? 'bottom-[calc(50%+6px)] flex-col' : 'top-[calc(50%+6px)] flex-col-reverse', x < 22 ? 'items-start' : x > 78 ? 'items-end' : 'items-center')}
            style={{ left: `${x}%` }}>
            <span className={cx('relative flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted py-1 ps-1 pe-2 group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-ring', x < 22 ? '-start-3.5' : x > 78 ? '-end-3.5' : '')}>
              <ProjectAvatar p={p} className="size-5.5" rounded="rounded-md" text="text-xs" />
              <span className="text-sm max-sm:hidden">{p.name.split(' ')[0]}</span>
              <span className={cx('rounded-full px-1.5 text-xs tabular-nums', tone(n))}>{n < 0 ? `${-n}d late` : `${n}d`}</span>
            </span>
            <span className="h-3.5 w-[1.5px] opacity-60" style={{ background: p.color }} />
            <span className={cx('absolute left-0 size-2.5 -translate-x-1/2 rounded-full ring-3 ring-card', up ? '-bottom-[11px]' : '-top-[11px]')} style={{ background: p.color }} />
          </a>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { state, mode, user, mutate } = useStore();
  const owner = mode !== 'member';
  const projects = useMemo(() => state.projects.filter(p => !p.archived).map(liveView), [state.projects]);
  const conversations = useProjectList().filter(x => !x.p.archived && x.msg).slice(0, 4);

  const deadlines = projects.filter(p => p.deadline && p.status !== 'completed' && p.status !== 'cancelled').sort((a, b) => daysLeft(a) - daysLeft(b));
  const review = projects
    .filter(p => canReview(owner ? 'owner' : 'client', myMember(p, user)))
    .map(p => ({ p, n: p.suggestions.filter(s => s.state === 'pending').length })).filter(x => x.n)
    .sort((a, b) => b.n - a.n);
  const toReview = review.reduce((n, x) => n + x.n, 0);

  // Open tasks by when they're due; the first eight across the groups.
  const tasks = projects
    .flatMap(p => p.items.filter(it => it.type === 'task' && isActive(it)).map(it => ({ p, it, n: it.due ? daysTo(it.due) : null })))
    .sort((a, b) => (a.it.due || '9999').localeCompare(b.it.due || '9999'));
  const groups = [['Late', x => x.n !== null && x.n < 0], ['Today', x => x.n === 0], ['This week', x => x.n > 0 && x.n <= 7], ['Later', x => x.n === null || x.n > 7]];
  let room = 8;
  const shown = groups.map(([label, f]) => { const list = tasks.filter(f).slice(0, room); room -= list.length; return [label, list]; }).filter(([, l]) => l.length);
  const done = (p, id) => mutate(p.id, q => setStatus(q, 'owner', id, 'done'));
  const unread = conversations.reduce((n, x) => n + x.unread, 0);

  return (
    <BrainShell wide>
      <div className="grid gap-5 lg:grid-cols-6">
        <Panel title="Deadlines" quiet href="#/calendar" action={<Count n={deadlines.length} />} className="lg:col-span-4">
          {deadlines.length ? <Timeline projects={deadlines} /> : <None>No project deadlines set. Add one in a project's details.</None>}
        </Panel>

        <Panel title="To review" quiet className="lg:col-span-2">
          {toReview ? (
            <div className="px-5 pt-3 pb-5">
              <div className="font-medium text-5xl tracking-tight tabular-nums">{toReview}</div>
              <p className="mt-1 text-sm text-text-secondary">suggestion{toReview === 1 ? '' : 's'} waiting in {review.length} project{review.length === 1 ? '' : 's'}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {review.map(({ p, n }) => (
                  <a key={p.id} href={`#/p/${p.id}/chat`} title={`${p.name}: ${n} to review`} className="flex items-center gap-1.5 rounded-full bg-field py-1 ps-1 pe-2.5 text-sm outline-none hover:bg-field-hover focus-visible:ring-2 focus-visible:ring-ring">
                    <ProjectAvatar p={p} className="size-5.5" rounded="rounded-md" text="text-xs" />
                    <span className="max-w-24 truncate">{p.name.split(' ')[0]}</span>
                    <span className="font-medium tabular-nums">{n}</span>
                  </a>
                ))}
              </div>
            </div>
          ) : <None>Nothing waiting for review.</None>}
        </Panel>

        <Panel title="Tasks" quiet action={<Count n={tasks.length} />} className="lg:col-span-3">
          {shown.length ? (
            <div className="flex flex-col gap-3 px-3 pt-2 pb-3">
              {shown.map(([label, list]) => (
                <section key={label}>
                  <h3 className={cx('mb-0.5 ms-2 text-label-mono', label === 'Late' ? 'text-neg-ink' : 'text-text-secondary')}>{label}</h3>
                  <ul>
                    {list.map(({ p, it }) => (
                      <li key={it.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-field-hover">
                        {owner
                          ? <button type="button" onClick={() => done(p, it.id)} aria-label={`Mark “${it.title}” done`} title="Mark done" className="grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] border-border-strong text-transparent outline-none hover:border-green hover:text-green focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3"><Check /></button>
                          : <span aria-hidden className="size-4.5 shrink-0 rounded-full border-[1.5px] border-border-strong" />}
                        <a href={`#/p/${p.id}/tasks/i/${it.id}`} className="min-w-0 flex-1 truncate text-sm outline-none focus-visible:underline">{it.title}</a>
                        <span title={p.name} className="flex max-w-24 shrink-0 items-center gap-1.5 text-xs text-text-secondary"><span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: p.color }} /><span className="truncate">{p.name.split(' ')[0]}</span></span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : <None>No open tasks. Nice.</None>}
        </Panel>

        <Panel title="Messages" quiet action={unread ? <span className="text-sm text-muted-foreground tabular-nums">{unread} new</span> : null} className="lg:col-span-3">
          {conversations.length ? (
            <ul className="flex flex-col gap-1 px-3 pt-2 pb-3">
              {conversations.map(({ p, unread: n, msg }) => (
                <li key={p.id}>
                  <a href={`#/p/${p.id}/chat`} className={cx('flex items-start gap-2.5 rounded-xl p-2 outline-none hover:bg-field-hover focus-visible:bg-field-hover', msg.mine && 'flex-row-reverse')}>
                    <InitialsAvatar name={msg.who} size="sm" />
                    <span className={cx('flex min-w-0 flex-1 flex-col', msg.mine && 'items-end')}>
                      <span className="flex max-w-full items-center gap-1 text-xs text-text-secondary">
                        {!msg.mine && <span className="font-medium text-foreground">{msg.who.split(' ')[0]}</span>}
                        {!msg.mine && <span aria-hidden>·</span>}
                        <span className="truncate">{p.name}</span><span aria-hidden>·</span><span className="shrink-0">{fmtRel(msg.ts)}</span>
                        {n > 0 && <span aria-label={`${n} unread`} className="ms-1 size-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span className={cx('mt-1 line-clamp-2 max-w-[92%] rounded-2xl px-3 py-2 text-sm', msg.mine ? 'rounded-tr-md bg-primary text-primary-foreground' : 'rounded-tl-md border border-border bg-muted')}>{msg.text}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <None>No messages yet.</None>}
        </Panel>
      </div>
    </BrainShell>
  );
}
