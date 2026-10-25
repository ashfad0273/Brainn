import { useState } from 'react';
import { Plus, Search, Settings as SettingsIcon, FolderOpen, Layers, MessageSquare, ListTodo, Sparkles, Archive, Lock, Brain } from 'lucide-react';
import { useStore } from '../store';
import { Button, Modal, Field, Input, Textarea, Select, Empty } from './ui';
import SettingsModal from './Settings';
import SearchModal from './Search';
import { newProject, updateMeta, secretValues, maskText } from '../lib/model';
import { PROJECT_COLORS, isActive } from '../lib/meta';
import { geminiOn } from '../lib/brain';
import { cx, fmtRel, uid, now } from '../lib/util';

const TAB_FOR_TYPE = { task: 'tasks', requirement: 'requirements', decision: 'decisions', sensitive: 'vault', file: 'files', question: 'memory', risk: 'memory' };

export function ProjectFormModal({ project, onClose, spaceId }) {
  const { state, update, mutate, toast } = useStore();
  const [d, setD] = useState(project
    ? { name: project.name, client: project.client, description: project.description, color: project.color, spaceId: project.spaceId || '' }
    : { name: '', client: '', description: '', color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length], spaceId: spaceId || state.spaces[0]?.id || '' });
  const set = k => e => setD(x => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!d.name.trim()) return toast('Give the project a name', 'error');
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
        <Field label="What is it? (helps the brain)"><Textarea value={d.description} onChange={set('description')} placeholder="One or two lines about the project" /></Field>
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

function ProjectCard({ p, i }) {
  const openTasks = p.items.filter(x => x.type === 'task' && isActive(x)).length;
  const pending = p.suggestions.filter(s => s.state === 'pending').length;
  const last = p.messages[p.messages.length - 1];
  const done = p.items.filter(x => x.type === 'task' && x.status === 'done').length;
  const total = p.items.filter(x => x.type === 'task' && x.status !== 'cancelled').length;
  return (
    <a href={`#/p/${p.id}/chat`} className="anim-up group block rounded-2xl overflow-hidden bg-[#181818] ring-1 ring-white/[.06] hover:ring-white/20 hover:-translate-y-1 transition duration-300" style={{ animationDelay: i * 50 + 'ms' }}>
      <div className="h-24 relative" style={{ background: `linear-gradient(135deg, ${p.color}55, ${p.color}08 70%)` }}>
        <div className="absolute left-5 bottom-0 translate-y-1/2 w-12 h-12 rounded-2xl grid place-items-center text-lg font-bold text-white shadow-lg" style={{ background: p.color }}>{p.name[0]}</div>
        <div className="absolute top-3 right-3 flex gap-1.5">
          {p.archived && <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/40 text-amber-200">Archived</span>}
          {p.invite && <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/40 text-emerald-200">Client invited</span>}
        </div>
      </div>
      <div className="p-5 pt-8">
        <h3 className="font-semibold text-lg leading-tight group-hover:text-white">{p.name}</h3>
        <p className="text-sm text-neutral-500 mt-0.5">{p.invite?.name || p.client || 'No client yet'}</p>
        {last && <p className="text-sm text-neutral-400 mt-3 line-clamp-2 min-h-[2.5rem]">{maskText(last.text, secretValues(p)) || last.attachments.map(a => a.name).join(', ')}</p>}
        <div className="h-1 bg-white/5 rounded-full overflow-hidden mt-4"><div className="h-full rounded-full" style={{ width: (total ? (done / total) * 100 : 0) + '%', background: p.color }} /></div>
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

export default function Home() {
  const { state, update, encrypted, lock } = useStore();
  const [space, setSpace] = useState('all');
  const [view, setView] = useState('active');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [newSpace, setNewSpace] = useState('');
  const gem = geminiOn(state.settings);

  const inSpace = state.projects.filter(p => space === 'all' || p.spaceId === space);
  const list = inSpace.filter(p => (view === 'archived') === !!p.archived)
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
      <aside className="w-60 shrink-0 border-r border-white/[.06] bg-[#151515] hidden md:flex flex-col">
        <div className="p-4 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white text-neutral-900 grid place-items-center"><Brain size={19} /></div>
          <div className="min-w-0"><div className="font-semibold truncate leading-tight">{state.settings.workspaceName}</div><div className="text-xs text-neutral-500">Project Brain</div></div>
        </div>
        <div className="px-3 text-[11px] uppercase tracking-wide text-neutral-500 mt-2 mb-1">Spaces</div>
        <nav className="px-2 space-y-0.5 flex-1 overflow-auto">
          {[{ id: 'all', name: 'All projects' }, ...state.spaces].map(s => {
            const n = state.projects.filter(p => !p.archived && (s.id === 'all' || p.spaceId === s.id)).length;
            return (
              <button key={s.id} onClick={() => setSpace(s.id)} className={cx('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition', space === s.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200')}>
                {s.id === 'all' ? <Layers size={15} /> : <FolderOpen size={15} />}<span className="flex-1 truncate">{s.name}</span><span className="text-xs text-neutral-600">{n}</span>
              </button>
            );
          })}
          <button onClick={() => setModal('space')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-500 hover:bg-white/5 hover:text-neutral-200"><Plus size={15} />New space</button>
        </nav>
        <div className="p-2 border-t border-white/[.06] space-y-0.5">
          <button onClick={() => setModal('settings')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5">
            <Sparkles size={15} />Gemini<span className={cx('ml-auto w-2 h-2 rounded-full', gem ? 'bg-emerald-400' : 'bg-neutral-600')} />
          </button>
          <button onClick={() => setModal('settings')} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5"><SettingsIcon size={15} />Settings</button>
          {encrypted && <button onClick={lock} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-neutral-300 hover:bg-white/5"><Lock size={15} />Lock workspace</button>}
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-8 md:py-12">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[240px]">
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{space === 'all' ? 'Your projects' : state.spaces.find(s => s.id === space)?.name}</h1>
              <p className="text-neutral-500 mt-1.5">Every client conversation, task, requirement and decision — remembered, linked, never lost.</p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="flex-1 sm:w-56 flex items-center gap-2 bg-[#181818] ring-1 ring-white/[.08] rounded-xl px-3 focus-within:ring-sky-500/60">
                <Search size={15} className="text-neutral-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter projects" className="bg-transparent outline-none py-2 text-sm w-full" />
              </div>
              <Button onClick={() => setModal('search')} title="Search inside every project"><Search size={15} /><span className="hidden lg:inline">Search everything</span></Button>
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setModal('settings')}><SettingsIcon size={17} /></Button>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-8 mb-5">
            {[['active', 'Active'], ['archived', `Archived${archivedCount ? ` · ${archivedCount}` : ''}`]].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={cx('px-3 py-1.5 rounded-lg text-sm', view === k ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white')}>{k === 'archived' && <Archive size={13} className="inline mr-1.5 -mt-0.5" />}{l}</button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((p, i) => <ProjectCard key={p.id} p={p} i={i} />)}
            {view === 'active' && (
              <button onClick={() => setModal('project')} className="anim-up rounded-2xl border-2 border-dashed border-white/10 hover:border-white/25 grid place-items-center min-h-[260px] text-neutral-500 hover:text-white transition">
                <div className="text-center"><Plus size={34} className="mx-auto" /><div className="mt-2 text-sm">New project</div></div>
              </button>
            )}
          </div>
          {view === 'archived' && !list.length && <Empty icon={Archive} title="No archived projects" text="Archive a finished project from its ⋯ menu. Its full history stays searchable." />}
        </div>
      </main>

      {modal === 'project' && <ProjectFormModal spaceId={space === 'all' ? undefined : space} onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
      {modal === 'search' && (
        <SearchModal projects={state.projects} names={{ owner: state.settings.ownerName }} onClose={() => setModal(null)}
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
