import { useMemo, useState } from 'react';
import { useTheme } from '@ume/ui/hooks/use-theme';
import { Calendar, Dashboard, Files, Layers, Moon, Search, Settings, Sun } from '@/lib/icons';
import { useStore } from '../store';
import SearchModal from './Search';
import { ProjectAvatar } from './ProjectArt';
import { liveView, namesFor, myMember, secretValues, maskText, primaryClient, timeLeftLabel } from '../lib/model';
import { useSeen, unreadCount } from '../lib/seen';
import { cx } from '../lib/util';

/* Brainn's frame, like Slack: on a desktop a rail on the left holds the pages and
   every project with its unread count. On a phone the pages sit in a bottom bar,
   the Projects page is the project list, and a project opens full screen over it. */

export const hashPath = () => location.hash.replace(/^#/, '') || '/';

export const PAGES = [
  ['/', 'Dashboard', Dashboard],
  ['/projects', 'Projects', Layers],
  ['/files', 'Files', Files],
  ['/calendar', 'Calendar', Calendar],
  ['/settings', 'Settings', Settings],
];
export const isOn = (page, path) => (page === '/' ? path === '/' : path === page || path.startsWith(page + '/'));

/* A round 40px icon button: muted at rest, the field grey on hover. */
export const iconButton = on => cx('relative grid size-10 shrink-0 place-items-center rounded-full outline-none transition-[scale] duration-fast ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5',
  on ? 'bg-field text-foreground' : 'text-icon-muted hover:bg-field hover:text-foreground');

export function Mark({ org, className = 'size-9' }) {
  if (org.logo) return <img src={org.logo} alt="" className={cx('shrink-0 rounded-[10px] object-cover', className)} />;
  return <span aria-hidden className={cx('grid shrink-0 place-items-center rounded-[10px] bg-foreground font-medium text-background', className)}>B</span>;
}

export const UnreadBadge = ({ n }) => (
  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{n}</span>
);

/** "Lucas: Can we also show…", the latest message as one line, or '' before the first one. */
function lastLine(p, ownerName) {
  const m = p.messages[p.messages.length - 1];
  if (!m) return '';
  const text = maskText(m.text, secretValues(p)).replace(/\*\*|~~|`/g, '') || m.attachments.map(a => a.name).join(', ') || 'Voice note';
  return `${namesFor(p, ownerName).msg(m).split(' ')[0]}: ${text}`;
}

/** Every project, most recent conversation first, with its unread count and latest message. */
export function useProjectList() {
  const { state, mode, user } = useStore();
  const seen = useSeen();
  const ownerName = state.settings.ownerName || 'You';
  return useMemo(() => state.projects.map(record => {
    const p = liveView(record);
    const me = mode === 'member' ? myMember(p, user) : null;
    const mine = me ? m => m.memberId === me.id : m => m.from === 'owner';
    return { p, unread: unreadCount(p, seen[p.id], mine), last: lastLine(p, ownerName), ts: p.messages[p.messages.length - 1]?.ts || p.createdAt };
  }).sort((a, b) => b.ts - a.ts), [state.projects, seen, mode, user, ownerName]);
}

const TAB_FOR_TYPE = { task: 'tasks', requirement: 'requirements', decision: 'decisions', sensitive: 'vault', file: 'files', question: 'memory', risk: 'memory' };

/** Search across every project; picking a result opens it in its project. */
export function GlobalSearch({ onClose }) {
  const { state } = useStore();
  return (
    <SearchModal projects={state.projects.map(liveView)} names={{ owner: state.settings.ownerName }} onClose={onClose}
      onPick={r => { onClose(); location.hash = r.kind === 'message' ? `#/p/${r.p.id}/chat/m/${r.id}` : r.kind === 'item' ? `#/p/${r.p.id}/${TAB_FOR_TYPE[r.it.type]}/i/${r.id}` : `#/p/${r.p.id}/memory`; }} />
  );
}

export function ThemeButton() {
  const { theme, toggle } = useTheme();
  const I = theme === 'dark' ? Sun : Moon;
  return <button type="button" onClick={toggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} className={iconButton(false)}><I aria-hidden /></button>;
}

const rowClass = on => cx('flex h-9.5 w-full items-center gap-2.5 rounded-xl px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring [&>svg]:size-4.5 [&>svg]:shrink-0',
  on ? 'bg-sidebar-active font-medium text-foreground' : 'text-text-secondary hover:bg-field hover:text-foreground');

/** The desktop rail. `current` is the open project's id, if any. */
export function Rail({ current = null }) {
  const { state } = useStore();
  const [search, setSearch] = useState(false);
  const list = useProjectList().filter(x => !x.p.archived);
  const path = hashPath();
  const org = state.settings.org || {};
  return (
    <aside className="sticky top-0 flex h-dvh w-63 shrink-0 flex-col bg-sidebar px-3 pt-4 pb-3 max-lg:hidden">
      <div className="flex items-center gap-2.5 ps-1 pb-4">
        <a href="#/" aria-label="Dashboard" className="rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring"><Mark org={org} /></a>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-sm">{org.name || state.settings.workspaceName || 'Brainn'}</div>
          <div className="text-xs text-muted-foreground">Brainn</div>
        </div>
        <button type="button" onClick={() => setSearch(true)} aria-label="Search everything" title="Search everything" className={iconButton(false)}><Search aria-hidden /></button>
      </div>

      <nav aria-label="Pages" className="flex flex-col gap-0.5">
        {PAGES.slice(0, 4).map(([href, label, I]) => {
          const on = !current && isOn(href, path);
          return (
            <a key={href} href={`#${href}`} aria-current={on ? 'page' : undefined} className={rowClass(on)}>
              <I aria-hidden />{href === '/projects' ? 'All projects' : label}
              {href === '/projects' && <span className="ms-auto text-xs text-muted-foreground tabular-nums">{list.length}</span>}
            </a>
          );
        })}
      </nav>

      <div className="mx-2.5 mt-5 mb-1.5 text-label-mono text-text-secondary">Projects</div>
      <nav aria-label="Projects" className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 thin-scrollbar autohide-scrollbar">
        {list.map(({ p, unread }) => (
          <a key={p.id} href={`#/p/${p.id}/chat`} aria-current={p.id === current ? 'page' : undefined} className={rowClass(p.id === current)}>
            <ProjectAvatar p={p} className="size-5.5" rounded="rounded-md" text="text-xs" />
            <span className={cx('min-w-0 flex-1 truncate', unread > 0 && p.id !== current && 'font-medium text-foreground')}>{p.name}</span>
            {unread > 0 && p.id !== current && <UnreadBadge n={unread} />}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-1 pt-3">
        <a href="#/settings" aria-current={isOn('/settings', path) ? 'page' : undefined} className={cx(rowClass(isOn('/settings', path)), 'flex-1')}><Settings aria-hidden />Settings</a>
        <ThemeButton />
      </div>
      {search && <GlobalSearch onClose={() => setSearch(false)} />}
    </aside>
  );
}

/** The phone's page bar, under every page but an open project. */
export function BottomNav() {
  const path = hashPath();
  return (
    <nav aria-label="Pages" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-background px-2 pt-1.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] lg:hidden">
      {PAGES.map(([href, label, I]) => {
        const on = isOn(href, path);
        return (
          <a key={href} href={`#${href}`} aria-current={on ? 'page' : undefined} className={cx('flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl pt-1 pb-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring', on ? 'font-medium text-foreground' : 'text-text-secondary')}>
            <span className={cx('grid h-8 w-14 place-items-center rounded-full [&_svg]:size-5', on && 'bg-field')}><I aria-hidden /></span>{label}
          </a>
        );
      })}
    </nav>
  );
}

/** A project in the phone's Projects list: its latest message, and unread ones in bold with a count. */
export function ProjectRow({ p, unread, last }) {
  const sub = last || [p.client || primaryClient(p)?.name, timeLeftLabel(p)].filter(Boolean).join(' · ');
  return (
    <a href={`#/p/${p.id}/chat`} className="flex items-center gap-3 rounded-2xl p-2.5 outline-none transition-[scale] duration-fast ease-out hover:bg-field-hover focus-visible:bg-field-hover active:scale-[0.99]">
      <ProjectAvatar p={p} className="size-10" rounded="rounded-xl" text="text-sm" />
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate', unread > 0 && 'font-medium')}>{p.name}</span>
        <span className={cx('block truncate text-sm', unread > 0 ? 'text-foreground' : 'text-text-secondary')}>{sub}</span>
      </span>
      {unread > 0 && <UnreadBadge n={unread} />}
    </a>
  );
}
