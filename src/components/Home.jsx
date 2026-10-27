import { useRef, useState } from 'react';
import { Plus, Search, Settings as SettingsIcon, FolderOpen, Layers, MessageSquare, ListTodo, Sparkles, Archive, Lock, Brain, ImagePlus, X, Users, Files, LogOut, CalendarClock } from 'lucide-react';
import { useStore } from '../store';
import { Button, Modal, Field, Input, Textarea, Select, Empty } from './ui';
import SettingsModal from './Settings';
import SearchModal from './Search';
import { newProject, updateMeta, secretValues, maskText, liveItems, liveView, activeMembers, primaryClient, projectProgress, timeLeftLabel, myMember, canReview } from '../lib/model';
import { StatusPill, ProgressBar, timeTone } from './Overview';
import { useAuth } from './Auth';
import { putBlob, isQuotaError } from '../lib/blobs';
import { optimizeImageIfNeeded } from '../lib/files';
import { ProjectAvatar, ProjectCover } from './ProjectArt';
import { PROJECT_COLORS, PROJECT_STATUS, isActive } from '../lib/meta';
import { aiOn, aiName } from '../lib/brain';
import { cx, fmtRel, uid, now, todayISO } from '../lib/util';

const TAB_FOR_TYPE = { task: 'tasks', requirement: 'requirements', decision: 'decisions', sensitive: 'vault', file: 'files', question: 'memory', risk: 'memory' };

/** Picks an image, stores it as a blob and returns a small reference ({ id, stored, name, mime }). */
function ImagePick({ label, value, onChange, wide }) {
  const { toast } = useStore();
  const ref = useRef();
  const pick = async origFile => {
    if (!origFile) return;
    if (!origFile.type.startsWith('image/')) return toast('Choose an image file', 'error');
    const file = await optimizeImageIfNeeded(origFile);
    const id = uid('img_');
    try { await putBlob(id, file); } catch (e) { return toast(isQuotaError(e) ? 'Browser storage is full — image not saved' : 'Could not store the image: ' + e.message, 'error'); }
    onChange({ id, stored: true, name: file.name, mime: file.type, size: file.size });
  };
  return (
    <div>
      <div className="text-xs font-medium text-neutral-400 mb-1">{label}</div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => ref.current.click()} className={cx('rounded-xl ring-1 ring-inset ring-white/10 hover:ring-white/25 bg-[#111] grid place-items-center text-neutral-500 overflow-hidden', wide ? 'h-16 flex-1' : 'h-16 w-16')}>
          {value ? <span className="text-xs text-neutral-300 px-2 truncate">{value.name}</span> : <ImagePlus size={18} />}
        </button>
        {value && <Button variant="ghost" size="iconSm" onClick={() => onChange(null)} title="Remove"><X size={14} /></Button>}
      </div>
    </div>
  );
}

export function ProjectFormModal({ project, onClose, spaceId }) {
  const { state, update, mutate, toast } = useStore();
  const [d, setD] = useState(project
    ? { name: project.name, client: project.client, description: project.description, color: project.color, spaceId: project.spaceId || '', cover: project.cover || null, avatar: project.avatar || null, deadline: project.deadline || '', status: project.status || 'in_progress' }
    : { name: '', client: '', description: '', color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length], spaceId: spaceId || state.spaces[0]?.id || '', cover: null, avatar: null, deadline: '', status: 'in_progress' });
  const set = k => e => setD(x => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!d.name.trim()) return toast('Give the project a name', 'error');
    if (!d.deadline) return toast('Pick the project deadline', 'error');
    const data = { ...d, name: d.name.trim(), client: d.client.trim(), spaceId: d.spaceId || null };
    if (project) mutate(project.id, q => updateMeta(q, 'owner', data));
    else {
      const p = newProject(data);
      update(s => ({ ...s, projects: [...s.projects, p] }));
      location.hash = `#/p/${p.id}/chat`;
    }
    onClose();
  };
  return (
    <Modal title={project ? 'Project details' : 'New project'} sub={project ? undefined : 'One project per client engagement. Its chat and records are kept forever.'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{project ? 'Save' : 'Create project'}</Button></>}>
      <div className="space-y-3">
        <Field label="Project name"><Input autoFocus value={d.name} onChange={set('name')} placeholder="e.g. Nova Café Website" /></Field>
        <Field label="Client"><Input value={d.client} onChange={set('client')} placeholder="Client or company name" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline" hint="Required — drives “time remaining”."><Input type="date" required min={project ? undefined : todayISO()} value={d.deadline} onChange={set('deadline')} /></Field>
          <Field label="Status"><Select value={d.status} onChange={set('status')}>{Object.entries(PROJECT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        </div>
        <Field label="What is it? (helps the brain)"><Textarea value={d.description} onChange={set('description')} placeholder="One or two lines about the project" /></Field>
        <div className="flex gap-3">
          <ImagePick label="Profile picture" value={d.avatar} onChange={v => setD(x => ({ ...x, avatar: v }))} />
          <div className="flex-1"><ImagePick wide label="Cover image" value={d.cover} onChange={v => setD(x => ({ ...x, cover: v }))} /></div>
        </div>
        <ProjectCover p={{ ...d, name: d.name || 'P' }} className="h-20 rounded-xl">
          <ProjectAvatar p={{ ...d, name: d.name || 'P' }} className="absolute left-3 bottom-3 w-10 h-10 shadow-lg" />
          <span className="absolute right-3 bottom-2 text-[11px] text-white/70">Preview — either image fills in for the other</span>
        </ProjectCover>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Space"><Select value={d.spaceId} onChange={set('spaceId')}><option value="">No space</option>{state.spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Colour">
            <div className="flex gap-1.5 flex-wrap pt-1.5">{PROJECT_COLORS.map(c => <button key={c} type="button" onClick={() => setD(x => ({ ...x, color: c }))} className={cx('w-6 h-6 rounded-full transition', d.color === c && 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1a1a]')} style={{ background: c }} />)}</div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ProjectCard({ p: record, i }) {
  const { mode, user } = useStore();
  const p = liveView(record);
  const items = p.items;
  const members = activeMembers(p);
  const openTasks = items.filter(x => x.type === 'task' && isActive(x)).length;
  const pending = canReview(mode === 'member' ? 'client' : 'owner', myMember(p, user)) ? p.suggestions.filter(s => s.state === 'pending').length : 0;
  const last = p.messages[p.messages.length - 1];
  const prog = projectProgress(p);
  return (
    <a href={`#/p/${p.id}/chat`} className="anim-up group block rounded-2xl overflow-hidden bg-[#181818] ring-1 ring-white/[.06] hover:ring-white/20 hover:-translate-y-1 transition duration-300" style={{ animationDelay: i * 50 + 'ms' }}>
      <div className="relative">
        <ProjectCover p={p} className="h-24">
          <div className="absolute top-3 right-3 flex gap-1.5">
            {p.archived && <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/40 text-amber-200">Archived</span>}
            <StatusPill status={p.status} className="bg-black/50 backdrop-blur" />
          </div>
        </ProjectCover>
        <ProjectAvatar p={p} className="absolute left-5 bottom-0 translate-y-1/2 w-12 h-12 shadow-lg ring-2 ring-[#181818]" rounded="rounded-2xl" text="text-lg" />
      </div>
      <div className="p-5 pt-8">
        <h3 className="font-semibold text-lg leading-tight group-hover:text-white">{p.name}</h3>
        <p className="text-sm text-neutral-500 mt-0.5 truncate">{p.client || primaryClient(p)?.name || 'No client yet'}</p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-1.5">
            {members.slice(0, 5).map((m, k) => <span key={m.id} title={m.name} className={cx('w-6 h-6 rounded-full ring-2 ring-[#181818] grid place-items-center text-[10px] font-semibold text-white', ['bg-orange-600', 'bg-violet-600', 'bg-emerald-600', 'bg-pink-600', 'bg-teal-600'][k % 5])}>{m.name[0]?.toUpperCase()}</span>)}
            {members.length > 5 && <span className="w-6 h-6 rounded-full ring-2 ring-[#181818] bg-neutral-700 grid place-items-center text-[10px]">+{members.length - 5}</span>}
          </div>
          {!members.length && <span className="text-xs text-neutral-600 flex items-center gap-1"><Users size={12} />No one invited</span>}
          <span className={cx('ml-auto text-xs flex items-center gap-1', timeTone(p))}><CalendarClock size={12} />{timeLeftLabel(p)}</span>
        </div>
        {last && <p className="text-sm text-neutral-400 mt-3 line-clamp-2 min-h-[2.5rem]">{maskText(last.text, secretValues(p)).replace(/\*\*|~~|`/g, '') || last.attachments.map(a => a.name).join(', ')}</p>}
        <div className="flex items-center gap-2 mt-4"><ProgressBar value={prog.value} color={p.color} className="flex-1" /><span className="text-[11px] text-neutral-400 tabular-nums">{prog.value}%</span></div>
        <div className="flex items-center gap-4 mt-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1"><ListTodo size={13} />{openTasks} open</span>
          <span className="flex items-center gap-1"><MessageSquare size={13} />{p.messages.length}</span>
          {pending > 0 && <span className="flex items-center gap-1 text-sky-300"><Sparkles size={13} />{pending} to review</span>}
          <span className="ml-auto">{last ? fmtRel(last.ts) : fmtRel(p.createdAt)}</span>
        </div>
      </div>
    </a>
  );
}

/** Left navigation shared by Home and the file manager. */
export function Sidebar({ active, space, setSpace, onNewSpace, onSettings }) {
  const { state, encrypted, lock, mode } = useStore();
  const auth = useAuth();
  const member = mode === 'member';
  const org = state.settings.org || {};
  const gem = aiOn(state.settings);
  const go = id => { if (setSpace) setSpace(id); location.hash = '#/'; };
  return (
    <aside className="w-60 shrink-0 border-r border-white/[.06] bg-[#151515] hidden md:flex flex-col">
      <div className="p-4 flex items-center gap-2.5">
        {org.logo
          ? <img src={org.logo} alt="" className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/10" />
          : <div className="w-9 h-9 rounded-xl grid place-items-center text-neutral-900" style={{ background: org.color || '#fff' }}><Brain size={19} /></div>}
        <div className="min-w-0"><div className="font-semibold truncate leading-tight">{org.name || state.settings.workspaceName}</div><div className="text-xs text-neutral-500 truncate">{auth?.user ? auth.user.name || auth.user.email : 'Project Brain'}</div></div>
      </div>
      <nav className="px-2 space-y-0.5 flex-1 overflow-auto">
        <a href="#/files" className={cx('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition', active === 'files' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200')}>
          <Files size={15} /><span className="flex-1">Files</span>
        </a>
        <div className="px-3 text-[11px] uppercase tracking-wide text-neutral-500 pt-3 pb-1">{member ? 'Projects' : 'Spaces'}</div>
        {[{ id: 'all', name: 'All projects' }, ...(member ? [] : state.spaces)].map(s => {
          const n = state.projects.filter(p => !p.archived && (s.id === 'all' || p.spaceId === s.id)).length;
          return (
            <button key={s.id} onClick={() => go(s.id)} className={cx('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition', active === 'projects' && space === s.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200')}>
              {s.id === 'all' ? <Layers size={15} /> : <FolderOpen size={15} />}<span className="flex-1 truncate">{s.name}</span><span className="text-xs text-neutral-600">{n}</span>
            </button>
          );
        })}
        {!member && onNewSpace && <button onClick={onNewSpace} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:bg-white/5 hover:text-neutral-200"><Plus size={15} />New space</button>}
      </nav>
      <div className="p-2 border-t border-white/[.06] space-y-0.5">
        {!member && (
          <button onClick={() => onSettings('ai')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5">
            <Sparkles size={15} /><span className="truncate">AI · {aiName(state.settings)}</span><span className={cx('ml-auto w-2 h-2 rounded-full', gem ? 'bg-emerald-400' : 'bg-neutral-600')} />
          </button>
        )}
        <button onClick={() => onSettings(member ? 'profile' : 'org')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5"><SettingsIcon size={15} />Settings</button>
        {encrypted && <button onClick={lock} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5"><Lock size={15} />Lock workspace</button>}
        {auth && <button onClick={auth.signOut} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-400 hover:bg-white/5"><LogOut size={15} />Sign out</button>}
      </div>
    </aside>
  );
}

export default function Home() {
  const { state, update, mode } = useStore();
  const member = mode === 'member';
  const [space, setSpace] = useState('all');
  const [view, setView] = useState('active');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [settingsTab, setSettingsTab] = useState('org');
  const [newSpace, setNewSpace] = useState('');
  const openSettings = t => { setSettingsTab(t); setModal('settings'); };

  const inSpace = state.projects.filter(p => space === 'all' || p.spaceId === space);
  const list = inSpace.filter(p => (view === 'archived') === !!p.archived)
    .filter(p => status === 'all' || p.status === status)
    .filter(p => !q || (p.name + ' ' + p.client).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.messages[b.messages.length - 1]?.ts || b.createdAt) - (a.messages[a.messages.length - 1]?.ts || a.createdAt));
  const archivedCount = inSpace.filter(p => p.archived).length;

  const addSpace = e => {
    e.preventDefault();
    if (!newSpace.trim()) return;
    const s = { id: uid('sp_'), name: newSpace.trim(), createdAt: now(), updatedAt: now() };
    update(st => ({ ...st, spaces: [...st.spaces, s] }));
    setSpace(s.id); setNewSpace(''); setModal(null);
  };

  return (
    <div className="h-full flex">
      <Sidebar active="projects" space={space} setSpace={setSpace} onNewSpace={() => setModal('space')} onSettings={openSettings} />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[240px]">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{space === 'all' ? (member ? 'Your projects' : 'Your projects') : state.spaces.find(s => s.id === space)?.name}</h1>
              <p className="text-neutral-500 mt-1.5">{member ? `Projects ${state.settings.ownerName} shared with you.` : 'Every client conversation, task, requirement and decision — remembered, linked, never lost.'}</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-56 flex items-center gap-2 bg-[#181818] ring-1 ring-white/[.08] rounded-xl px-3 focus-within:ring-sky-500/60">
                <Search size={15} className="text-neutral-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter projects" className="bg-transparent outline-none py-2 text-sm w-full" />
              </div>
              <Button onClick={() => setModal('search')} title="Search inside every project"><Search size={15} /><span className="hidden lg:inline">Search everything</span></Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => { location.hash = '#/files'; }} title="Files"><Files size={17} /></Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => openSettings(member ? 'profile' : 'org')}><SettingsIcon size={17} /></Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 mt-8 mb-5">
            {[['active', 'Active'], ['archived', `Archived${archivedCount ? ` · ${archivedCount}` : ''}`]].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={cx('px-3 py-1.5 rounded-lg text-sm', view === k ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white')}>{k === 'archived' && <Archive size={13} className="inline mr-1.5 -mt-0.5" />}{l}</button>
            ))}
            <div className="w-px h-5 bg-white/10 mx-2" />
            {[['all', 'Any status'], ...Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)} className={cx('px-2.5 py-1 rounded-lg text-xs', status === k ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white')}>{l}</button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((p, i) => <ProjectCard key={p.id} p={p} i={i} />)}
            {view === 'active' && !member && (
              <button onClick={() => setModal('project')} className="anim-up rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 grid place-items-center min-h-[260px] text-neutral-500 hover:text-white transition">
                <div className="text-center"><Plus size={34} className="mx-auto" /><div className="mt-2 text-sm">New project</div></div>
              </button>
            )}
          </div>
          {member && !list.length && view === 'active' && <Empty icon={Layers} title="No projects yet" text={`When ${state.settings.ownerName} gives you access to a project, it shows up here.`} />}
          {view === 'archived' && !list.length && <Empty icon={Archive} title="No archived projects" text="Archive a finished project from its ⋯ menu. Its full history stays searchable." />}
        </div>
      </main>

      {modal === 'project' && <ProjectFormModal spaceId={space === 'all' ? undefined : space} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal initialTab={settingsTab} onClose={() => setModal(null)} />}
      {modal === 'search' && (
        <SearchModal projects={state.projects.map(liveView)} names={{ owner: state.settings.ownerName }} onClose={() => setModal(null)}
          onPick={r => { setModal(null); location.hash = r.kind === 'message' ? `#/p/${r.p.id}/chat/m/${r.id}` : r.kind === 'item' ? `#/p/${r.p.id}/${TAB_FOR_TYPE[r.it.type]}/i/${r.id}` : `#/p/${r.p.id}/memory`; }} />
      )}
      {modal === 'space' && (
        <Modal title="New space" sub="Group projects — by client type, team, or however you work." onClose={() => setModal(null)}>
          <form onSubmit={addSpace} className="flex gap-2"><Input autoFocus value={newSpace} onChange={e => setNewSpace(e.target.value)} placeholder="e.g. Retainer clients" /><Button type="submit" variant="primary">Create</Button></form>
        </Modal>
      )}
    </div>
  );
}
