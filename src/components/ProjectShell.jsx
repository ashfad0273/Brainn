import { useCallback, useEffect, useMemo, useState } from 'react';
import { Add, Check, RefreshCw, Undo2, Search, UserPlus, MoreHorizontal, Archive, ArchiveRestore, Download, Pencil, MessageSquare, ListTodo, ListChecks, GitBranch, Lock, Paperclip, Brain, History, Sparkles, X, Info, ChevronLeft, SlidersHorizontal } from '@/lib/icons';
import { Popover, PopoverTrigger, PopoverPopup } from '@ume/ui/components/ui/popover';
import { Sheet, SheetPopup } from '@ume/ui/components/ui/sheet';
import { useIsMobileNav, useMediaQuery } from '@ume/ui/hooks/use-media-query';
import { InitialsAvatar } from '@ume/ui/components/patterns/IconChip';
import { useStore } from '../store';
import { PCtx, useP, Button, Menu, MenuItem, Drawer } from './ui';
import { Rail, UnreadBadge, iconButton, tabPill, tabRow, useProjectList } from './Rail';
import Chat from './Chat';
import { useRescan, IgnoredSuggestions } from './Suggestions';
import { TasksView, RequirementsView, DecisionsView, VaultView, FilesView } from './Items';
import ItemDrawer from './ItemDrawer';
import MemoryView from './Memory';
import TimelineView from './Timeline';
import SearchModal from './Search';
import Assistant from './Assistant';
import MembersModal from './Invite';
import { ProjectFormModal } from './Home';
import { ProjectAvatar } from './ProjectArt';
import ProjectOverview, { ProgressBar, timeTone } from './Overview';
import { updateMeta, liveView, namesFor, activeMembers, myMember, canReview, setStatus as setItemStatus, projectHealth, projectProgress, timeLeftLabel } from '../lib/model';
import { isActive, COLOR, memberRole } from '../lib/meta';
import { markSeen } from '../lib/seen';
import { cx, download, todayISO } from '../lib/util';

const TABS = {
  chat: ['Messages', MessageSquare, Chat], tasks: ['Tasks', ListTodo, TasksView], requirements: ['Requirements', ListChecks, RequirementsView],
  decisions: ['Decisions', GitBranch, DecisionsView], vault: ['Vault', Lock, VaultView], files: ['Files', Paperclip, FilesView],
  memory: ['Memory', Brain, MemoryView], timeline: ['Timeline', History, TimelineView],
};
// The tab row holds the four tabs used every day; the rest open from the More menu.
const PILL = ['chat', 'tasks', 'files', 'memory'];
const TAB_FOR_TYPE = { task: 'tasks', requirement: 'requirements', decision: 'decisions', sensitive: 'vault', file: 'files', question: 'memory', risk: 'memory' };
const REASON_TONE = { rose: 'text-destructive-foreground', amber: 'text-warn-ink' };

function counts(p, role, me) {
  const a = t => p.items.filter(i => i.type === t && isActive(i)).length;
  return {
    chat: canReview(role, me) ? p.suggestions.filter(s => s.state === 'pending').length : 0,
    tasks: a('task'), requirements: a('requirement'), decisions: a('decision'), vault: a('sensitive'),
    files: p.items.filter(i => i.type === 'file').length, memory: a('question') + a('risk'),
  };
}

const dueDate = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };

/* A titled block of the details panel; blocks are split by a hairline. */
function Block({ title, action, children }) {
  return (
    <section className="border-t border-border pt-4 pb-1 first:border-t-0 first:pt-0">
      {title && (
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="text-label-mono text-text-secondary">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* One property: the name on the left, the value on the right, on one line. */
const Prop = ({ label, children }) => (
  <div className="flex min-h-9 items-center gap-3 text-sm">
    <span className="w-20 shrink-0 text-text-secondary">{label}</span>
    <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
  </div>
);

/* Open tasks, soonest due first: tick one off or open it. */
function NextTasks({ onAll }) {
  const { p, role, mut, openItem } = useP();
  const today = todayISO();
  const open = p.items.filter(i => i.type === 'task' && isActive(i)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  return (
    <Block title="Next tasks" action={open.length > 4 && <button type="button" onClick={onAll} className="text-xs text-text-secondary outline-none hover:text-foreground focus-visible:underline">All {open.length}</button>}>
      {open.length ? (
        <ul className="-mx-2">
          {open.slice(0, 4).map(t => (
            <li key={t.id} className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-field-hover">
              {role === 'owner'
                ? <button type="button" onClick={() => mut(q => setItemStatus(q, 'owner', t.id, 'done'))} aria-label={`Mark “${t.title}” done`} title="Mark done" className="mt-px grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] border-border-strong text-transparent hover:border-green hover:text-green [&_svg]:size-3"><Check /></button>
                : <span aria-hidden className="mt-px size-4.5 shrink-0 rounded-full border-[1.5px] border-border-strong" />}
              <button type="button" onClick={() => openItem(t.id)} className="flex min-w-0 flex-1 items-baseline gap-2 text-left outline-none focus-visible:underline">
                <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                {t.due && <span className={cx('shrink-0 text-xs', t.due < today ? 'text-destructive-foreground' : t.due === today ? 'text-warn-ink' : 'text-text-secondary')}>{t.due < today ? 'Overdue' : t.due === today ? 'Today' : dueDate(t.due)}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="py-1.5 text-sm text-muted-foreground">No open tasks.</p>}
    </Block>
  );
}

/* Behind ⓘ, or docked beside the card on a wide screen: what the project is, where it stands,
   what's next and who's on it. Changing any of it is in More → Status & progress. */
function InfoPanel({ onMessage, onInvite, onTasks, docked }) {
  const { p, names, role } = useP();
  const { state } = useStore();
  const health = projectHealth(p);
  const progress = projectProgress(p).value;
  const members = activeMembers(p);
  // Before anyone is invited, the client named on the project still shows, so you can see who it's for.
  const people = [{ id: 'owner', name: state.settings.ownerName || names.owner, role: 'Owner' }, ...members.map(m => ({ id: m.id, name: m.name, role: memberRole(m) })),
    ...(!members.length && p.client ? [{ id: 'client', name: p.client, role: 'Client' }] : [])];
  return (
    <div className="flex w-full flex-col gap-4">
      {/* Docked, the card's header already names the project; the description stays. */}
      {docked ? (p.description && <Block><p className="text-sm text-text-secondary">{p.description}</p></Block>) : (
        <Block>
          <div className="flex items-center gap-3">
            <ProjectAvatar p={p} className="size-10" rounded="rounded-xl" text="text-sm" />
            <div className="min-w-0">
              <div className="truncate font-medium">{p.name}</div>
              <div className="truncate text-xs text-text-secondary">{p.description || p.client || names.client}</div>
            </div>
          </div>
        </Block>
      )}
      <Block>
        <Prop label="Health">
          <span aria-hidden className={cx('size-2 shrink-0 rounded-full', COLOR[health.tone].dot)} />
          <span className="shrink-0">{health.label}</span>
          <span className={cx('truncate text-xs', REASON_TONE[health.tone] || 'text-text-secondary')}>{health.reason}</span>
        </Prop>
        <Prop label="Due">
          <span className="shrink-0">{p.deadline ? dueDate(p.deadline) : 'No date'}</span>
          {p.deadline && <span className={cx('truncate text-xs', timeTone(p))}>{timeLeftLabel(p)}</span>}
        </Prop>
        <Prop label="Progress">
          <ProgressBar value={progress} color={p.color} className="flex-1" />
          <span className="w-9 shrink-0 text-end tabular-nums">{progress}%</span>
        </Prop>
      </Block>
      <NextTasks onAll={onTasks} />
      <Block title="People">
        <ul className="-mx-2">
          {people.map(x => (
            <li key={x.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-field-hover">
              <InitialsAvatar name={x.name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm">{x.id === 'owner' && role === 'owner' ? 'You' : x.name}</span>
              <span className="shrink-0 text-xs text-text-secondary">{x.role}</span>
              {x.id !== 'owner' && <Button variant="ghost" size="iconSm" onClick={onMessage} aria-label={`Message ${x.name}`} title={`Message ${x.name}`} className="-me-1 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"><MessageSquare /></Button>}
            </li>
          ))}
          {role === 'owner' && (
            <li>
              <button type="button" onClick={onInvite} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm text-text-secondary outline-none hover:bg-field-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                <span className="grid size-7 place-items-center rounded-full bg-field text-icon-muted [&_svg]:size-4"><Add /></span>Invite someone
              </button>
            </li>
          )}
        </ul>
      </Block>
    </div>
  );
}

/* ⓘ: on a wide screen it opens and closes the docked panel; otherwise a popover under
   the button, or a sheet from the bottom on a phone. */
function InfoButton({ onInvite, onMessage, onTasks, wide, docked, onDock }) {
  const phone = useIsMobileNav();
  const [open, setOpen] = useState(false);
  if (wide) return <button type="button" onClick={onDock} aria-pressed={docked} aria-label={docked ? 'Hide project details' : 'Show project details'} title={docked ? 'Hide details' : 'Show details'} className={iconButton(docked)}><Info aria-hidden /></button>;
  const close = fn => () => { setOpen(false); fn(); };
  const panel = <InfoPanel onInvite={close(onInvite)} onMessage={close(onMessage)} onTasks={close(onTasks)} />;
  const button = <button type="button" onClick={phone ? () => setOpen(true) : undefined} aria-label="Project info" title="Info" className={iconButton(open)}><Info aria-hidden /></button>;
  if (phone) return (
    <>
      {button}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetPopup side="bottom" showCloseButton={false} className="max-h-[86dvh]">
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border-strong" />
          <div className="overflow-y-auto px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{panel}</div>
        </SheetPopup>
      </Sheet>
    </>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={button} />
      <PopoverPopup align="end" sideOffset={8} className="w-96 rounded-[20px] [&_[data-slot=popover-viewport]]:p-5">{panel}</PopoverPopup>
    </Popover>
  );
}

/** Shared frame for a project: the rail, then one card with the name, the tabs and the view. Used by owner and members. */
/** `mut` replaces the local-store mutation, e.g. for a member portal that writes through the server. */
export function ProjectShell({ p: record, role, me = null, names, tabs, tab, setTab, actions, onInvite, deep, searchProjects, mut = null }) {
  const { mutate } = useStore();
  const [drawer, setDrawer] = useState(null);
  const [focus, setFocus] = useState(null);
  const [search, setSearch] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [status, setStatus] = useState(false); // the status, progress and deadline controls
  const [ignored, setIgnored] = useState(false);
  const [rescan, scanning] = useRescan(record.id);
  const p = useMemo(() => liveView(record), [record]); // deleted items are hidden everywhere
  // Wide screens keep the details docked beside the card; the choice is remembered on this device.
  const wide = useMediaQuery({ min: 1440 });
  const [dock, setDock] = useState(() => { try { return localStorage.getItem('brainn-details') !== '0'; } catch { return true; } });
  const toggleDock = () => setDock(d => { try { localStorage.setItem('brainn-details', d ? '0' : '1'); } catch { /* not remembered */ } return !d; });
  const docked = wide && dock;
  const elsewhere = useProjectList().reduce((n, x) => n + (x.p.id === p.id || x.p.archived ? 0 : x.unread), 0);

  /** Open the chat at a message; with a span, the exact passage is highlighted. */
  const jumpTo = useCallback((id, span = null) => { setDrawer(null); setStatus(false); setFocus({ id, span, n: Date.now() }); setTab('chat'); }, [setTab]);
  useEffect(() => {
    if (!deep) return;
    if (deep.kind === 'm') jumpTo(deep.ref);
    if (deep.kind === 'i') setDrawer(deep.ref);
  }, [deep?.kind, deep?.ref]); // eslint-disable-line react-hooks/exhaustive-deps
  // Reading the chat catches you up on this project.
  useEffect(() => { if (tab === 'chat') markSeen(p.id, p.messages[p.messages.length - 1]?.ts); }, [tab, p.id, p.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ p, role, me, names, openItem: setDrawer, jumpTo, mut: mut || (fn => mutate(p.id, fn)), openSearch: () => setSearch(true) }), [p, role, me, names, jumpTo, mutate, mut]);
  const n = counts(p, role, me);
  const View = TABS[tab]?.[2] || Chat;
  const health = projectHealth(p);
  const nIgnored = p.suggestions.filter(s => s.state === 'ignored').length;

  return (
    <PCtx.Provider value={ctx}>
      <div className="flex h-dvh bg-background text-foreground">
        <Rail current={p.id} />
        <div className="flex min-w-0 flex-1 overflow-hidden bg-card lg:my-2 lg:me-2 lg:rounded-[20px] lg:border lg:border-border lg:shadow-card">
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center gap-1 ps-1.5 pe-2 pt-3 pb-2.5 lg:gap-2 lg:ps-5 lg:pe-4 lg:pt-3.5 lg:pb-3">
              {/* Phones: back to the project list, with how many messages wait in the others. */}
              <a href="#/projects" aria-label={elsewhere ? `Projects, ${elsewhere} unread` : 'Projects'} title="Projects" className="flex h-10 shrink-0 items-center gap-0.5 rounded-full ps-0.5 pe-2 outline-none hover:bg-field focus-visible:ring-2 focus-visible:ring-ring lg:hidden [&>svg]:size-6.5">
                <ChevronLeft aria-hidden />{elsewhere > 0 && <UnreadBadge n={elsewhere} />}
              </a>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-medium text-lg">{p.name}</h1>
                <p className="flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
                  <span className="truncate">{p.client || names.client}</span>
                  <span aria-hidden>·</span><span className={cx('shrink-0', timeTone(p))}>{timeLeftLabel(p)}</span>
                  <span aria-hidden className="max-lg:hidden">·</span>
                  <span className="flex shrink-0 items-center gap-1.5 max-lg:hidden"><span aria-hidden className={cx('size-2 rounded-full', COLOR[health.tone].dot)} />{health.label}</span>
                </p>
              </div>
              <button type="button" onClick={() => setSearch(true)} aria-label="Search this project" title="Search this project" className={cx(iconButton(false), 'max-lg:hidden')}><Search aria-hidden /></button>
              <InfoButton onInvite={onInvite || (() => {})} onMessage={() => setTab('chat')} onTasks={() => setTab('tasks')} wide={wide} docked={docked} onDock={toggleDock} />
              <Menu trigger={t => <button type="button" onClick={t} aria-label="More" title="More" className={iconButton(false)}><MoreHorizontal aria-hidden /></button>}>
                <MenuItem icon={Search} onClick={() => setSearch(true)}>Search this project</MenuItem>
                {role === 'owner' && <MenuItem icon={Sparkles} onClick={() => setAssistant(true)}>Assistant</MenuItem>}
                <MenuItem icon={SlidersHorizontal} onClick={() => setStatus(true)}>Status & progress</MenuItem>
                {canReview(role, me) && <MenuItem icon={RefreshCw} onClick={rescan} hint={scanning ? 'Reading…' : undefined}>Re-scan messages</MenuItem>}
                {canReview(role, me) && nIgnored > 0 && <MenuItem icon={Undo2} onClick={() => setIgnored(true)} hint={nIgnored}>Ignored suggestions</MenuItem>}
                {tabs.filter(k => !PILL.includes(k)).map(k => { const [label, I] = TABS[k]; return <MenuItem key={k} icon={I} onClick={() => setTab(k)}>{label}</MenuItem>; })}
                {actions}
              </Menu>
            </header>

            <nav aria-label="Project" className={tabRow}>
              {tabs.filter(k => PILL.includes(k) || k === tab).map(k => {
                const [label, I] = TABS[k];
                const on = tab === k;
                return (
                  <button key={k} type="button" onClick={() => setTab(k)} aria-current={on ? 'page' : undefined} className={tabPill(on)}>
                    <I aria-hidden />{label}{n[k] > 0 && <span className="font-normal text-muted-foreground tabular-nums">{n[k]}</span>}
                  </button>
                );
              })}
            </nav>

            <main className="flex min-h-0 flex-1">
              <div className={cx('flex min-h-0 w-full', tab === 'chat' && 'mx-auto max-w-3xl')}><View focus={focus} /></div>
            </main>
          </div>
          {docked && (
            <aside aria-label="Project details" className="w-84 shrink-0 overflow-y-auto border-s border-border px-5 pb-6 thin-scrollbar autohide-scrollbar">
              {/* Lines up with the card's own header row. */}
              <div className="flex h-16 items-center justify-between">
                <h2 className="font-medium">Details</h2>
                <button type="button" onClick={toggleDock} aria-label="Hide details" title="Hide details" className={iconButton(false)}><X aria-hidden /></button>
              </div>
              <InfoPanel docked onInvite={onInvite || (() => {})} onMessage={() => setTab('chat')} onTasks={() => setTab('tasks')} />
            </aside>
          )}
        </div>
      </div>
      {drawer && <ItemDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {ignored && <IgnoredSuggestions onClose={() => setIgnored(false)} />}
      {status && <Drawer onClose={() => setStatus(false)}><ProjectOverview onClose={() => setStatus(false)} /></Drawer>}
      {assistant && (
        <Drawer onClose={() => setAssistant(false)}>
          <div className="flex justify-end px-3 pt-3"><Button variant="ghost" size="icon" onClick={() => setAssistant(false)} aria-label="Close"><X size={18} /></Button></div>
          <div className="px-5 pb-5"><Assistant compact /></div>
        </Drawer>
      )}
      {search && (
        <SearchModal projects={(searchProjects || [record]).map(liveView)} names={names} onClose={() => setSearch(false)}
          onPick={r => { setSearch(false); if (r.kind === 'message') jumpTo(r.id); else if (r.kind === 'item') { setTab(TAB_FOR_TYPE[r.it.type]); setDrawer(r.id); } else setTab('memory'); }} />
      )}
    </PCtx.Provider>
  );
}

/** A project page: the owner's full view, or an invited person's view limited by their permissions. */
export default function ProjectPage({ p, tab, deep }) {
  const { state, mutate, toast, mode, user } = useStore();
  const [modal, setModal] = useState(null);
  const owner = mode !== 'member';
  const me = owner ? null : myMember(p, user);
  const names = useMemo(() => namesFor(p, state.settings.ownerName || 'You'), [p, state.settings.ownerName]);
  const setTab = useCallback(t => { location.hash = `#/p/${p.id}/${t}`; }, [p.id]);
  const members = activeMembers(p);
  const perms = me?.perms || {};
  const tabs = owner ? Object.keys(TABS)
    : ['chat', perms.tasks && 'tasks', perms.requirements && 'requirements', perms.decisions && 'decisions', perms.files && 'files', perms.summary && 'memory'].filter(Boolean);

  const actions = owner && (
    <>
      <MenuItem icon={UserPlus} onClick={() => setModal('members')}>{members.length ? `Members · ${members.length}` : 'Invite people'}</MenuItem>
      <MenuItem icon={Pencil} onClick={() => setModal('edit')}>Edit project details</MenuItem>
      <MenuItem icon={Download} onClick={() => download(`${p.name.replace(/\W+/g, '-').toLowerCase()}-record.json`, JSON.stringify(p, null, 2))}>Export project record</MenuItem>
      {p.archived
        ? <MenuItem icon={ArchiveRestore} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: false }, 'project.unarchive')); toast('Project restored'); }}>Restore from archive</MenuItem>
        : <MenuItem icon={Archive} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: true }, 'project.archive')); toast('Archived — full history kept'); }}>Archive project</MenuItem>}
    </>
  );

  return (
    <>
      <ProjectShell p={p} role={owner ? 'owner' : 'client'} me={me} names={names} tabs={tabs} tab={tabs.includes(tab) ? tab : 'chat'} setTab={setTab} actions={actions} onInvite={owner ? () => setModal('members') : undefined} deep={deep} searchProjects={owner ? undefined : [p]} />
      {modal === 'members' && <MembersModal p={p} onClose={() => setModal(null)} />}
      {modal === 'edit' && <ProjectFormModal project={p} onClose={() => setModal(null)} />}
    </>
  );
}
