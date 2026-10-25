import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, UserPlus, MoreHorizontal, Archive, ArchiveRestore, Download, Pencil, Braces, MessageSquare, ListTodo, ListChecks, GitBranch, Lock, Paperclip, Brain, History, Sparkles, KeyRound, X } from 'lucide-react';
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
import InviteModal from './Invite';
import SettingsModal from './Settings';
import { ProjectFormModal } from './Home';
import { updateMeta } from '../lib/model';
import { geminiOn } from '../lib/brain';
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

/** Shared frame for a project: header, tabs, views, item drawer, search. Used by owner and client. */
export function ProjectShell({ p, role, names, tabs, tab, setTab, header, deep, searchProjects }) {
  const { mutate } = useStore();
  const [drawer, setDrawer] = useState(null);
  const [focus, setFocus] = useState(null);
  const [search, setSearch] = useState(false);
  const [inbox, setInbox] = useState(false);
  const [assistant, setAssistant] = useState(false);

  const jumpTo = useCallback(id => { setDrawer(null); setInbox(false); setFocus({ id, n: Date.now() }); setTab('chat'); }, [setTab]);
  useEffect(() => {
    if (!deep) return;
    if (deep.kind === 'm') jumpTo(deep.ref);
    if (deep.kind === 'i') setDrawer(deep.ref);
  }, [deep?.kind, deep?.ref]); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = useMemo(() => ({ p, role, names, openItem: setDrawer, jumpTo, mut: fn => mutate(p.id, fn), openSearch: () => setSearch(true) }), [p, role, names, jumpTo, mutate]);
  const n = counts(p, role);
  const View = TABS[tab]?.[2] || Chat;

  return (
    <PCtx.Provider value={ctx}>
      <div className="h-full flex flex-col">
        <header className="shrink-0 border-b border-white/[.06] bg-[#141414]">
          <div className="h-14 flex items-center gap-3 px-3 md:px-5">
            {header}
            <Button variant="ghost" size="sm" onClick={() => setSearch(true)} title="Search this project"><Search size={15} /><span className="hidden sm:inline">Search</span></Button>
            {role === 'owner' && <Button variant="ghost" size="sm" className="text-sky-300" onClick={() => setAssistant(true)} title="Project assistant"><Sparkles size={15} /><span className="hidden sm:inline">Assistant</span></Button>}
            {role === 'owner' && n.chat > 0 &&<Button variant="ghost" size="sm" className="xl:hidden text-sky-300" onClick={() => setInbox(true)}><Sparkles size={14} />{n.chat}</Button>}
          </div>
          <nav className="flex gap-0.5 px-2 md:px-4 overflow-x-auto">
            {tabs.map(k => {
              const [label, Icon] = TABS[k];
              return (
                <button key={k} onClick={() => setTab(k)} className={cx('relative flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap transition', tab === k ? 'text-white' : 'text-neutral-500 hover:text-neutral-200')}>
                  <Icon size={15} />{label}
                  {n[k] > 0 && <span className={cx('text-[10px] min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center', k === 'chat' ? 'bg-sky-500 text-white' : 'bg-white/10 text-neutral-300')}>{n[k]}</span>}
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
        <SearchModal projects={searchProjects || [p]} names={names} onClose={() => setSearch(false)}
          onPick={r => { setSearch(false); if (r.kind === 'message') jumpTo(r.id); else if (r.kind === 'item') { setTab(TAB_FOR_TYPE[r.it.type]); setDrawer(r.id); } else setTab('memory'); }} />
      )}
    </PCtx.Provider>
  );
}

/** Owner's view of a project. */
export default function ProjectPage({ p, tab, deep }) {
  const { state, mutate, toast } = useStore();
  const [modal, setModal] = useState(null);
  const names = useMemo(() => ({ owner: state.settings.ownerName || 'You', client: p.invite?.name || p.client || 'Client' }), [state.settings.ownerName, p.invite?.name, p.client]);
  const setTab = useCallback(t => { location.hash = `#/p/${p.id}/${t}`; }, [p.id]);
  const gem = geminiOn(state.settings);

  const header = (
    <>
      <a href="#/" className="p-1.5 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white" title="All projects"><ArrowLeft size={18} /></a>
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.color }} />
      <div className="min-w-0 flex-1">
        <div className="font-semibold truncate leading-tight">{p.name}{p.archived && <span className="ml-2 text-xs text-amber-300 font-normal">archived</span>}</div>
        <div className="text-xs text-neutral-500 truncate">{names.client}</div>
      </div>
      <button onClick={() => setModal('settings')} className={cx('hidden md:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ring-1 ring-inset', gem ? 'ring-emerald-500/30 text-emerald-300' : 'ring-white/10 text-neutral-400')} title="Gemini settings">
        <span className={cx('w-1.5 h-1.5 rounded-full', gem ? 'bg-emerald-400' : 'bg-neutral-500')} />{gem ? 'Gemini on' : 'Built-in rules'}
      </button>
      <Button size="sm" variant={p.invite ? 'default' : 'primary'} onClick={() => setModal('invite')}><UserPlus size={14} /><span className="hidden sm:inline">{p.invite ? `Client · PIN ${p.invite.pin}` : 'Invite client'}</span></Button>
      <Menu trigger={t => <Button variant="ghost" size="icon" onClick={t} title="More"><MoreHorizontal size={18} /></Button>}>
        <MenuItem icon={Pencil} onClick={() => setModal('edit')}>Edit project details</MenuItem>
        <MenuItem icon={Braces} onClick={() => setTab('timeline')}>Timeline & raw JSON</MenuItem>
        <MenuItem icon={Download} onClick={() => download(`${p.name.replace(/\W+/g, '-').toLowerCase()}-record.json`, JSON.stringify(p, null, 2))}>Export project record</MenuItem>
        <MenuItem icon={KeyRound} onClick={() => setModal('settings')}>Gemini & settings</MenuItem>
        {p.archived
          ? <MenuItem icon={ArchiveRestore} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: false }, 'project.unarchive')); toast('Project restored'); }}>Restore from archive</MenuItem>
          : <MenuItem icon={Archive} onClick={() => { mutate(p.id, q => updateMeta(q, 'owner', { archived: true }, 'project.archive')); toast('Archived — full history kept'); }}>Archive project</MenuItem>}
      </Menu>
    </>
  );

  return (
    <>
      <ProjectShell p={p} role="owner" names={names} tabs={Object.keys(TABS)} tab={TABS[tab] ? tab : 'chat'} setTab={setTab} header={header} deep={deep} />
      {modal === 'invite' && <InviteModal p={p} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <ProjectFormModal project={p} onClose={() => setModal(null)} />}
    </>
  );
}
