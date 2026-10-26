import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Users, MoreHorizontal, Archive, ArchiveRestore, Download, Pencil, Braces, MessageSquare, ListTodo, ListChecks, GitBranch, Lock, Paperclip, Brain, History, Sparkles, KeyRound, X, LayoutGrid } from 'lucide-react';
import { useStore } from '../store';
import { PCtx, Button, Menu, MenuItem, Drawer } from './ui';
import Chat from './Chat';
import { TasksView, RequirementsView, DecisionsView, VaultView, FilesView } from './Items';
import ItemDrawer from './ItemDrawer';
import MemoryView from './Memory';
import TimelineView from './Timeline';
import SearchModal from './Search';
import { ChatSidebar, SuggestionsInbox } from './Suggestions';
import Assistant from './Assistant';
import MembersModal from './Invite';
import SettingsModal from './Settings';
import { ProjectFormModal } from './Home';
import { ProjectAvatar } from './ProjectArt';
import { updateMeta, liveView, namesFor, activeMembers } from '../lib/model';
import { aiOn, aiName } from '../lib/brain';
import { isActive } from '../lib/meta';
import { cx, download } from '../lib/util';

const TABS = {
  chat: ['Chat', MessageSquare, Chat], tasks: ['Tasks', ListTodo, TasksView], requirements: ['Requirements', ListChecks, RequirementsView],
  decisions: ['Decisions', GitBranch, DecisionsView], vault: ['Vault', Lock, VaultView], files: ['Files', Paperclip, FilesView],
  memory: ['Memory', Brain, MemoryView], timeline: ['Timeline', History, TimelineView],
};
const TAB_FOR_TYPE = { task: 'tasks', requirement: 'requirements', decision: 'decisions', sensitive: 'vault', file: 'files', question: 'memory', risk: 'memory' };

function counts(p, role) {
  const a = t => p.items.filter(i => i.type === t && isActive(i)).length;
  return {
    chat: role === 'owner' ? p.suggestions.filter(s => s.state === 'pending').length : 0,
    tasks: a('task'), requirements: a('requirement'), decisions: a('decision'), vault: a('sensitive'),
    files: p.items.filter(i => i.type === 'file').length, memory: a('question') + a('risk'),
  };
}

/** Shared frame for a project: header, tabs, views, item drawer, search. Used by owner and members. */
export function ProjectShell({ p: record, role, me = null, names, tabs, tab, setTab, header, deep, searchProjects }) {
  const { mutate } = useStore();
  const [drawer, setDrawer] = useState(null);
  const [focus, setFocus] = useState(null);
  const [search, setSearch] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const p = useMemo(() => liveView(record), [record]); // deleted items are hidden everywhere

  /** Open the chat at a message; with a span, the exact passage is highlighted. */
  const jumpTo = useCallback((id, span = null) => { setDrawer(null); setInbox(false); setFocus({ id, span, n: Date.now() }); setTab('chat'); }, [setTab]);
  useEffect(() => {
    if (!deep) return;
    if (deep.kind === 'm') jumpTo(deep.ref);
    if (deep.kind === 'i') setDrawer(deep.ref);
  }, [deep?.kind, deep?.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ p, role, me, names, openItem: setDrawer, jumpTo, mut: fn => mutate(p.id, fn), openSearch: () => setSearch(true) }), [p, role, me, names, jumpTo, mutate]);
  const n = counts(p, role);
  const View = TABS[tab]?.[2] || Chat;
  const badge = (k, cls) => n[k] > 0 && <span className={cx('text-[10px] min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center', k === 'chat' ? 'bg-sky-500 text-white' : 'bg-white/10 text-neutral-300', cls)}>{n[k]}</span>;

  return (
    <PCtx.Provider value={ctx}>
      <div className="h-full flex flex-col">
        <header className="shrink-0 border-b border-white/[.06] bg-[#141414]">
          <div className="h-12 md:h-14 flex items-center gap-1.5 md:gap-3 px-1.5 md:px-5">
            {header}
            <Button variant="ghost" size="sm" className="px-2 sm:px-2.5" onClick={() => setSearch(true)} title="Search this project"><Search size={15} /><span className="hidden sm:inline">Search</span></Button>
            {role === 'owner' && <Button variant="ghost" size="sm" className="text-sky-300 px-2 sm:px-2.5" onClick={() => setAssistant(true)} title="Project assistant"><Sparkles size={15} /><span className="hidden sm:inline">Assistant</span></Button>}
            {role === 'owner' && n.chat > 0 && <Button variant="ghost" size="sm" className="xl:hidden text-sky-300 px-2" onClick={() => setInbox(true)} title="Suggestions to review"><span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] grid place-items-center">{n.chat}</span></Button>}
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
                <button key={k} onClick={() => setTab(k)} className={cx('relative flex items-center gap-1.5 px-3 py-2 md:py-2.5 text-sm whitespace-nowrap transition', tab === k ? 'text-white' : 'text-neutral-500 hover:text-neutral-200')}>
                  <Icon size={15} />{label}{badge(k)}
                  {tab === k && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-white" />}
                </button>
              );
            })}
          </nav>
        </header>
        <div className="flex-1 min-h-0 flex">
          <View focus={focus} />
          {tab === 'chat' && role === 'owner' && <ChatSidebar />}
        </div>
      </div>
      {drawer && <ItemDrawer id={drawer} onClose={() => setDrawer(null)} />}
      {inbox && (
        <Drawer onClose={() => setInbox(false)}>
          <div className="flex justify-end px-3 pt-3"><Button variant="ghost" size="icon" onClick={() => setInbox(false)} aria-label="Close"><X size={18} /></Button></div>
          <div className="px-5 pb-5"><SuggestionsInbox /></div>
        </Drawer>
      )}
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

/** Owner's view of a project. */
export default function ProjectPage({ p, tab, deep }) {
  const { state, mutate, toast } = useStore();
  const [modal, setModal] = useState(null);
  const names = useMemo(() => namesFor(p, state.settings.ownerName || 'You'), [p, state.settings.ownerName]);
  const setTab = useCallback(t => { location.hash = `#/p/${p.id}/${t}`; }, [p.id]);
  const gem = aiOn(state.settings);
  const members = activeMembers(p);

  const header = (
    <>
      <a href="#/" className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white shrink-0" title="All projects"><ArrowLeft size={18} /></a>
      <ProjectAvatar p={p} className="w-8 h-8 md:w-9 md:h-9" rounded="rounded-full md:rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate leading-tight text-[15px] md:text-base">{p.name}{p.archived && <span className="ml-2 text-xs text-amber-300 font-normal">archived</span>}</div>
        <div className="text-xs text-neutral-500 truncate">{members.length ? members.map(m => m.name.split(' ')[0]).join(', ') : p.client || 'No members yet'}</div>
      </div>
      <button onClick={() => setModal('settings')} className={cx('hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ring-1 ring-inset', gem ? 'ring-emerald-500/30 text-emerald-300' : 'ring-white/10 text-neutral-400')} title="AI settings">
        <span className={cx('w-1.5 h-1.5 rounded-full', gem ? 'bg-emerald-400' : 'bg-neutral-500')} />{aiName(state.settings)}
      </button>
      <Button size="sm" className="hidden sm:inline-flex px-2.5" variant={members.length ? 'default' : 'primary'} onClick={() => setModal('members')} title="Members, links and PINs">
        <Users size={14} /><span className="hidden sm:inline">{members.length ? `Members · ${members.length}` : 'Invite'}</span>
      </Button>
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
    </>
  );

  return (
    <>
      <ProjectShell p={p} role="owner" names={names} tabs={Object.keys(TABS)} tab={TABS[tab] ? tab : 'chat'} setTab={setTab} header={header} deep={deep} />
      {modal === 'members' && <MembersModal p={p} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <ProjectFormModal project={p} onClose={() => setModal(null)} />}
    </>
  );
}
