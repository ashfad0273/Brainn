import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Users, MoreHorizontal, Archive, ArchiveRestore, Download, Pencil, Braces, MessageSquare, ListTodo, ListChecks, GitBranch, Lock, Paperclip, Brain, History, Sparkles, KeyRound, X, LayoutGrid, PanelRight } from '@/lib/icons';
import { useStore } from '../store';
import { PCtx, Button, Menu, MenuItem, Drawer } from './ui';
import Chat from './Chat';
import { TasksView, RequirementsView, DecisionsView, VaultView, FilesView } from './Items';
import ItemDrawer from './ItemDrawer';
import MemoryView from './Memory';
import TimelineView from './Timeline';
import SearchModal from './Search';
import Assistant from './Assistant';
import MembersModal from './Invite';
import SettingsModal from './Settings';
import { ProjectFormModal } from './Home';
import { ProjectAvatar } from './ProjectArt';
import ProjectOverview, { StatusPill } from './Overview';
import { updateMeta, liveView, namesFor, activeMembers, myMember, canReview } from '../lib/model';
import { aiOn, aiName } from '../lib/brain';
import { isActive } from '../lib/meta';
import { cx, download } from '../lib/util';

const TABS = {
  chat: ['Chat', MessageSquare, Chat], tasks: ['Tasks', ListTodo, TasksView], requirements: ['Requirements', ListChecks, RequirementsView],
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

/** Shared frame for a project: header, tabs, views, item drawer, search. Used by owner and members. */
/** `mut` replaces the local-store mutation, e.g. for a member portal that writes through the server. */
export function ProjectShell({ p: record, role, me = null, names, tabs, tab, setTab, header, deep, searchProjects, mut = null }) {
  const { mutate } = useStore();
  const [drawer, setDrawer] = useState(null);
  const [focus, setFocus] = useState(null);
  const [search, setSearch] = useState(false);
  const [assistant, setAssistant] = useState(false);
  // the overview panel on the right: remembered open/closed on wide screens, a drawer on narrow ones
  const [side, setSide] = useState(() => { try { return localStorage.getItem('pb-overview') !== '0'; } catch { return true; } });
  const [sideDrawer, setSideDrawer] = useState(false);
  const toggleSide = () => {
    if (!matchMedia('(min-width: 1280px)').matches) return setSideDrawer(true);
    setSide(v => { try { localStorage.setItem('pb-overview', v ? '0' : '1'); } catch { /* private mode */ } return !v; });
  };
  const p = useMemo(() => liveView(record), [record]); // deleted items are hidden everywhere

  /** Open the chat at a message; with a span, the exact passage is highlighted. */
  const jumpTo = useCallback((id, span = null) => { setDrawer(null); setSideDrawer(false); setFocus({ id, span, n: Date.now() }); setTab('chat'); }, [setTab]);
  useEffect(() => {
    if (!deep) return;
    if (deep.kind === 'm') jumpTo(deep.ref);
    if (deep.kind === 'i') setDrawer(deep.ref);
  }, [deep?.kind, deep?.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ p, role, me, names, openItem: setDrawer, jumpTo, mut: mut || (fn => mutate(p.id, fn)), openSearch: () => setSearch(true) }), [p, role, me, names, jumpTo, mutate, mut]);
  const n = counts(p, role, me);
  const View = TABS[tab]?.[2] || Chat;
  const badge = (k, cls) => n[k] > 0 && <span className={cx('text-xs min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center', k === 'chat' ? 'bg-primary text-primary-foreground' : 'bg-field-hover text-foreground', cls)}>{n[k]}</span>;

  return (
    <PCtx.Provider value={ctx}>
      <div className="h-full flex flex-col">
        <header className="shrink-0 border-b border-border bg-card">
          <div className="h-12 md:h-14 flex items-center gap-1.5 md:gap-3 px-1.5 md:px-5">
            {header}
            <Button variant="ghost" size="sm" className="px-2 sm:px-2.5" onClick={() => setSearch(true)} title="Search this project"><Search size={15} /><span className="hidden sm:inline">Search</span></Button>
            {role === 'owner' && <Button variant="ghost" size="sm" className="text-primary px-2 sm:px-2.5" onClick={() => setAssistant(true)} title="Project assistant"><Sparkles size={15} /><span className="hidden sm:inline">Assistant</span></Button>}
            <Button variant="ghost" size="icon" onClick={toggleSide} title="Project overview" className={cx(side && 'xl:text-foreground xl:bg-field')}><PanelRight size={17} /></Button>
            {/* phones: the tabs live in a menu so the chat keeps the whole screen */}
            <div className="md:hidden">
              <Menu trigger={t => <Button variant="ghost" size="icon" onClick={t} title="Sections"><LayoutGrid size={17} /></Button>}>
                {tabs.map(k => { const [label, Icon] = TABS[k]; return <MenuItem key={k} icon={Icon} onClick={() => setTab(k)} hint={n[k] || ''}>{tab === k ? <b>{label}</b> : label}</MenuItem>; })}
              </Menu>
            </div>
          </div>
          <nav className={cx('gap-0.5 px-2 md:px-4 overflow-x-auto', tab === 'chat' ? 'hidden md:flex' : 'flex')}>
            {tabs.map(k => {
              const [label, Icon] = TABS[k];
              return (
                <button key={k} onClick={() => setTab(k)} className={cx('relative flex items-center gap-1.5 px-3 py-2 md:py-2.5 text-sm whitespace-nowrap transition', tab === k ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon size={15} />{label}{badge(k)}
                  {tab === k && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-btn-primary" />}
                </button>
              );
            })}
          </nav>
        </header>
        <div className="flex-1 min-h-0 flex">
          <View focus={focus} />
          {side && <aside className="w-[300px] shrink-0 border-l border-border bg-card overflow-auto hidden xl:block"><ProjectOverview /></aside>}
        </div>
      </div>
      {drawer && <ItemDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {sideDrawer && <Drawer onClose={() => setSideDrawer(false)}><ProjectOverview onClose={() => setSideDrawer(false)} /></Drawer>}
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
  const gem = aiOn(state.settings);
  const members = activeMembers(p);
  const perms = me?.perms || {};
  const tabs = owner ? Object.keys(TABS)
    : ['chat', perms.tasks && 'tasks', perms.requirements && 'requirements', perms.decisions && 'decisions', perms.files && 'files', perms.summary && 'memory'].filter(Boolean);

  const header = (
    <>
      <a href="#/" className="p-1.5 rounded-lg hover:bg-field-hover text-muted-foreground hover:text-foreground shrink-0" title="All projects"><ArrowLeft size={18} /></a>
      <ProjectAvatar p={p} className="w-8 h-8 md:w-9 md:h-9" rounded="rounded-full md:rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate leading-tight text-sm md:text-base flex items-center gap-2"><span className="truncate">{p.name}</span><StatusPill status={p.status} className="hidden md:inline-flex" /></div>
        <div className="text-xs text-muted-foreground truncate">{owner ? (members.length ? members.map(m => m.name.split(' ')[0]).join(', ') : p.client || 'No members yet') : `with ${names.owner}`}</div>
      </div>
      {owner && (
        <button onClick={() => setModal('settings')} className={cx('hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ring-1 ring-inset', gem ? 'ring-green-ring text-pos' : 'ring-border text-muted-foreground')} title="AI settings">
          <span className={cx('w-1.5 h-1.5 rounded-full', gem ? 'bg-green' : 'bg-grey-400')} />{aiName(state.settings)}
        </button>
      )}
      {owner && (
        <Button size="sm" className="hidden sm:inline-flex px-2.5" variant={members.length ? 'default' : 'primary'} onClick={() => setModal('members')} title="Who can open this project">
          <Users size={14} /><span className="hidden sm:inline">{members.length ? `Members · ${members.length}` : 'Invite'}</span>
        </Button>
      )}
      {owner && (
        <Menu trigger={t => <Button variant="ghost" size="icon" onClick={t} title="More"><MoreHorizontal size={18} /></Button>}>
          <MenuItem icon={Pencil} onClick={() => setModal('edit')}>Edit project details & images</MenuItem>
          <MenuItem icon={Users} onClick={() => setModal('members')}>Members</MenuItem>
          <MenuItem icon={Braces} onClick={() => setTab('timeline')}>Timeline & raw JSON</MenuItem>
          <MenuItem icon={Download} onClick={() => download(`${p.name.replace(/\W+/g, '-').toLowerCase()}-record.json`, JSON.stringify(p, null, 2))}>Export project record</MenuItem>
          <MenuItem icon={KeyRound} onClick={() => setModal('settings')}>AI & settings</MenuItem>
          {p.archived
            ? <MenuItem icon={ArchiveRestore} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: false }, 'project.unarchive')); toast('Project restored'); }}>Restore from archive</MenuItem>
            : <MenuItem icon={Archive} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: true }, 'project.archive')); toast('Archived — full history kept'); }}>Archive project</MenuItem>}
        </Menu>
      )}
    </>
  );

  return (
    <>
      <ProjectShell p={p} role={owner ? 'owner' : 'client'} me={me} names={names} tabs={tabs} tab={tabs.includes(tab) ? tab : 'chat'} setTab={setTab} header={header} deep={deep} searchProjects={owner ? undefined : [p]} />
      {modal === 'members' && <MembersModal p={p} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <ProjectFormModal project={p} onClose={() => setModal(null)} />}
    </>
  );
}
