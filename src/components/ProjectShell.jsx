import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Users, UserPlus, MoreHorizontal, Archive, ArchiveRestore, Download, Pencil, Braces, MessageSquare, ListTodo, ListChecks, GitBranch, Lock, Paperclip, Brain, History, Sparkles, KeyRound, X, Info, Check, Plus, ChevronDown, Dashboard, Layers } from '@/lib/icons';
import { useStore } from '../store';
import { PCtx, useP, Button, Input, Menu, MenuItem, Drawer } from './ui';
import { Panel } from './Shell';
import { InitialsAvatar } from '@ume/ui/components/patterns/IconChip';
import { fmtDate } from '@ume/ui/lib/format';
import Chat from './Chat';
import { TasksView, RequirementsView, DecisionsView, VaultView, FilesView } from './Items';
import ItemDrawer from './ItemDrawer';
import MemoryView from './Memory';
import TimelineView from './Timeline';
import SearchModal from './Search';
import Assistant from './Assistant';
import MembersModal from './Invite';
import { ProjectFormModal } from './Home';
import { ProjectAvatar } from './ProjectArt';
import ProjectOverview from './Overview';
import { updateMeta, liveView, namesFor, activeMembers, myMember, canReview, addItem, setStatus, projectHealth } from '../lib/model';
import { isActive, COLOR, memberRole } from '../lib/meta';
import { cx, download } from '../lib/util';

const TABS = {
  chat: ['Messages', MessageSquare, Chat], tasks: ['Tasks', ListTodo, TasksView], requirements: ['Requirements', ListChecks, RequirementsView],
  decisions: ['Decisions', GitBranch, DecisionsView], vault: ['Vault', Lock, VaultView], files: ['Files', Paperclip, FilesView],
  memory: ['Memory', Brain, MemoryView], timeline: ['Timeline', History, TimelineView],
};
const TAB_FOR_TYPE = { task: 'tasks', requirement: 'requirements', decision: 'decisions', sensitive: 'vault', file: 'files', question: 'memory', risk: 'memory' };

function counts(p, role, me) {
  const a = t => p.items.filter(i => i.type === t && isActive(i)).length;
  return {
    chat: canReview(role, me) ? p.suggestions.filter(s => s.state === 'pending').length : 0,
    tasks: a('task'), requirements: a('requirement'), decisions: a('decision'), vault: a('sensitive'),
    files: p.items.filter(i => i.type === 'file').length, memory: a('question') + a('risk'),
  };
}

/* Open tasks in a column beside the chat: tick one off, open it, or add one. */
function TaskColumn({ setTab }) {
  const { p, role, mut, openItem } = useP();
  const [title, setTitle] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const open = p.items.filter(i => i.type === 'task' && isActive(i)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const done = p.items.filter(i => i.type === 'task' && i.status === 'done').length;
  const add = e => { e.preventDefault(); if (!title.trim()) return; mut(q => addItem(q, 'owner', { type: 'task', title: title.trim(), assignee: 'owner' })); setTitle(''); };
  return (
    <div className="flex h-full flex-col">
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto thin-scrollbar autohide-scrollbar">
        {open.map(t => (
          <li key={t.id} className="flex items-start gap-3 px-5 py-3 hover:bg-field-hover">
            {role === 'owner'
              ? <button type="button" onClick={() => mut(q => setStatus(q, 'owner', t.id, 'done'))} aria-label={`Mark “${t.title}” done`} title="Mark done" className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full border border-border-strong text-transparent hover:border-green hover:text-green [&_svg]:size-3"><Check /></button>
              : <span aria-hidden className="mt-0.5 size-4.5 shrink-0 rounded-full border border-border-strong" />}
            <button type="button" onClick={() => openItem(t.id)} className="min-w-0 flex-1 text-left outline-none">
              <span className="block text-sm">{t.title}</span>
              {(t.due || t.status === 'blocked') && (
                <span className={cx('text-xs', t.status === 'blocked' ? 'text-warn-ink' : t.due < today ? 'text-destructive-foreground' : t.due === today ? 'text-warn-ink' : 'text-muted-foreground')}>
                  {t.status === 'blocked' ? 'Blocked' : t.due < today ? `Overdue · ${fmtDate(t.due)}` : t.due === today ? 'Due today' : `Due ${fmtDate(t.due)}`}
                </span>
              )}
            </button>
          </li>
        ))}
        {!open.length && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No open tasks.</li>}
      </ul>
      {role === 'owner' && (
        <form onSubmit={add} className="border-t border-border p-3">
          <Input size="sm" leadingIcon={Plus} value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a task" aria-label="Add a task" />
        </form>
      )}
      <button type="button" onClick={() => setTab('tasks')} className="border-t border-border px-5 py-3 text-left text-xs text-muted-foreground hover:text-foreground">{done} done · See all tasks</button>
    </div>
  );
}

/* Who the project is, where it stands and who's on it. */
function InfoColumn() {
  const { p, names } = useP();
  const { state } = useStore();
  const members = activeMembers(p);
  const health = projectHealth(p);
  const people = [{ id: 'owner', name: state.settings.ownerName || names.owner, role: 'Owner' }, ...members.map(m => ({ id: m.id, name: m.name, role: memberRole(m) }))];
  return (
    <div className="h-full overflow-y-auto thin-scrollbar autohide-scrollbar">
      <div className="px-5 pt-5">
        <div className="flex -space-x-3">
          <ProjectAvatar p={p} className="size-14 ring-4 ring-card" rounded="rounded-full" text="text-lg" />
          {names.client && <InitialsAvatar name={names.client} size="lg" className="size-14 ring-4 ring-card" />}
        </div>
        <h2 className="mt-4 font-medium text-xl">{p.name}</h2>
        <p className="mt-0.5 text-sm text-text-secondary">{p.client || names.client}{p.description ? ` · ${p.description}` : ''}</p>
        <div className="mt-3 flex items-center gap-2 text-sm"><span aria-hidden className={cx('size-2 rounded-full', COLOR[health.tone].dot)} /><span className="font-medium">{health.label}</span><span className="truncate text-muted-foreground">{health.reason}</span></div>
      </div>
      <ProjectOverview hidePeople />
      <div className="border-t border-border p-5">
        <div className="mb-3 text-label-mono text-muted-foreground">People · {people.length}</div>
        <div className="grid grid-cols-3 gap-y-4">
          {people.map(x => (
            <div key={x.id} className="flex min-w-0 flex-col items-center text-center">
              <InitialsAvatar name={x.name} size="lg" />
              <span className="mt-2 w-full truncate font-medium text-sm">{x.name.split(' ')[0]}</span>
              <span className="w-full truncate text-xs text-muted-foreground">{x.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* The project's name in the bar, and the way out: Dashboard, all projects, or straight to another one. */
function ProjectSwitcher({ p }) {
  const { state } = useStore();
  const others = state.projects.filter(x => x.id !== p.id && !x.archived);
  return (
    <Menu align="left" trigger={t => (
      <button type="button" onClick={t} className="flex h-10 min-w-0 items-center gap-2 rounded-full ps-1 pe-3 outline-none hover:bg-field focus-visible:ring-2 focus-visible:ring-ring" title="Switch project">
        <ProjectAvatar p={p} className="size-8" rounded="rounded-full" text="text-xs" />
        <span className="max-w-56 truncate font-medium text-sm max-sm:hidden">{p.name}</span>
        <ChevronDown className="size-4 shrink-0 text-icon-muted" />
      </button>
    )}>
      <MenuItem icon={Dashboard} onClick={() => { location.hash = '#/'; }}>Dashboard</MenuItem>
      <MenuItem icon={Layers} onClick={() => { location.hash = '#/projects'; }}>All projects</MenuItem>
      {others.length > 0 && <div className="px-2.5 pt-2.5 pb-1.5 text-label-mono text-text-secondary">Go to project</div>}
      {others.map(x => <MenuItem key={x.id} icon={() => <ProjectAvatar p={x} className="size-5" rounded="rounded-md" text="text-xs" />} onClick={() => { location.hash = `#/p/${x.id}/chat`; }}>{x.name}</MenuItem>)}
    </Menu>
  );
}

const barButton = on => cx('relative grid size-10 shrink-0 place-items-center rounded-full outline-none transition-[scale] duration-fast ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-5',
  on ? 'bg-field text-foreground' : 'text-icon-muted hover:bg-field hover:text-foreground');

/** Shared frame for a project: the bar (the mark, the switcher, the tabs, actions), then the view. Used by owner and members. */
/** `mut` replaces the local-store mutation, e.g. for a member portal that writes through the server. */
export function ProjectShell({ p: record, role, me = null, names, tabs, tab, setTab, actions, deep, searchProjects, mut = null }) {
  const { mutate } = useStore();
  const [drawer, setDrawer] = useState(null);
  const [focus, setFocus] = useState(null);
  const [search, setSearch] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [info, setInfo] = useState(false); // below lg the Info column is a drawer
  const p = useMemo(() => liveView(record), [record]); // deleted items are hidden everywhere

  /** Open the chat at a message; with a span, the exact passage is highlighted. */
  const jumpTo = useCallback((id, span = null) => { setDrawer(null); setInfo(false); setFocus({ id, span, n: Date.now() }); setTab('chat'); }, [setTab]);
  useEffect(() => {
    if (!deep) return;
    if (deep.kind === 'm') jumpTo(deep.ref);
    if (deep.kind === 'i') setDrawer(deep.ref);
  }, [deep?.kind, deep?.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ p, role, me, names, openItem: setDrawer, jumpTo, mut: mut || (fn => mutate(p.id, fn)), openSearch: () => setSearch(true) }), [p, role, me, names, jumpTo, mutate, mut]);
  const n = counts(p, role, me);
  const View = TABS[tab]?.[2] || Chat;

  return (
    <PCtx.Provider value={ctx}>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        {/* Phones: mark, switcher and actions on one row, the tabs scroll on the next. */}
        <header className="flex flex-wrap items-center gap-x-2 gap-y-3 px-4 py-4 sm:px-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:py-5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <a href="#/" aria-label="Dashboard" title="Dashboard" className="shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-foreground font-medium text-lg text-background">B</span>
            </a>
            <ProjectSwitcher p={p} />
          </div>
          <nav aria-label="Project" className="scroll-fade-x order-last -mx-4 flex w-[calc(100%+2rem)] items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:order-none lg:mx-0 lg:w-auto lg:px-0">
            {tabs.map(k => {
              const [label, I] = TABS[k];
              const on = tab === k;
              return on ? (
                <button key={k} type="button" aria-current="page" className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-field ps-3.5 pe-4 font-medium text-sm text-foreground [&_svg]:size-5">
                  <I aria-hidden />{label}{n[k] > 0 && <span className="text-muted-foreground tabular-nums">{n[k]}</span>}
                </button>
              ) : (
                <button key={k} type="button" onClick={() => setTab(k)} aria-label={n[k] ? `${label}, ${n[k]}` : label} title={label} className={barButton(false)}>
                  <I aria-hidden />
                  {k === 'chat' && n.chat > 0 && <span aria-hidden className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-background" />}
                </button>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-1 lg:justify-self-end">
            <button type="button" onClick={() => setSearch(true)} aria-label="Search this project" title="Search this project" className={barButton(false)}><Search aria-hidden /></button>
            {role === 'owner' && <button type="button" onClick={() => setAssistant(true)} aria-label="Project assistant" title="Project assistant" className={barButton(false)}><Sparkles aria-hidden /></button>}
            {tab === 'chat' && <button type="button" onClick={() => setInfo(true)} aria-label="Project info" title="Project info" className={cx(barButton(false), 'lg:hidden')}><Info aria-hidden /></button>}
            {actions}
          </div>
        </header>

        <main className="min-h-0 flex-1 px-4 pb-4 sm:px-6 sm:pb-6">
          {tab === 'chat' ? (
            <div className="grid h-full gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
              <Panel title="Tasks" icon={ListTodo} className="max-lg:hidden"><TaskColumn setTab={setTab} /></Panel>
              <Panel title="Messages" icon={MessageSquare} bodyClassName="flex"><Chat focus={focus} /></Panel>
              <Panel title="Info" icon={Info} className="max-lg:hidden"><InfoColumn /></Panel>
            </div>
          ) : (
            <div className="flex h-full overflow-hidden rounded-2xl border border-border bg-card shadow-card"><View focus={focus} /></div>
          )}
        </main>
      </div>
      {drawer && <ItemDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {info && <Drawer onClose={() => setInfo(false)}><div className="flex justify-end px-3 pt-3"><Button variant="ghost" size="icon" onClick={() => setInfo(false)} aria-label="Close"><X size={18} /></Button></div><InfoColumn /></Drawer>}
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
      <button type="button" onClick={() => setModal('members')} aria-label={members.length ? `Members, ${members.length}` : 'Invite'} title={members.length ? 'Members' : 'Invite people'} className={barButton(false)}><UserPlus aria-hidden /></button>
      <Menu trigger={t => <button type="button" onClick={t} aria-label="More" title="More" className={barButton(false)}><MoreHorizontal aria-hidden /></button>}>
        <MenuItem icon={Pencil} onClick={() => setModal('edit')}>Edit project details & images</MenuItem>
        <MenuItem icon={Users} onClick={() => setModal('members')}>Members</MenuItem>
        <MenuItem icon={Braces} onClick={() => setTab('timeline')}>Timeline & raw JSON</MenuItem>
        <MenuItem icon={Download} onClick={() => download(`${p.name.replace(/\W+/g, '-').toLowerCase()}-record.json`, JSON.stringify(p, null, 2))}>Export project record</MenuItem>
        <MenuItem icon={KeyRound} onClick={() => { location.hash = '#/settings/ai'; }}>AI & settings</MenuItem>
        {p.archived
          ? <MenuItem icon={ArchiveRestore} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: false }, 'project.unarchive')); toast('Project restored'); }}>Restore from archive</MenuItem>
          : <MenuItem icon={Archive} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: true }, 'project.archive')); toast('Archived — full history kept'); }}>Archive project</MenuItem>}
      </Menu>
    </>
  );

  return (
    <>
      <ProjectShell p={p} role={owner ? 'owner' : 'client'} me={me} names={names} tabs={tabs} tab={tabs.includes(tab) ? tab : 'chat'} setTab={setTab} actions={actions} deep={deep} searchProjects={owner ? undefined : [p]} />
      {modal === 'members' && <MembersModal p={p} onClose={() => setModal(null)} />}
      {modal === 'edit' && <ProjectFormModal project={p} onClose={() => setModal(null)} />}
    </>
  );
}
