import { useRef, useState } from 'react';
import { Plus, Search, Layers, MessageSquare, ListTodo, Sparkles, Archive, ImagePlus, X, Users, CalendarClock } from '@/lib/icons';
import { useStore } from '../store';
import { Button, Modal, Field, Input, Textarea, Select, Empty } from './ui';
import BrainShell from './Shell';
import { PageTopbar } from '@ume/ui/components/shell/PageTopbar';
import { FilterBar, FilterClear, FilterSection } from '@ume/ui/components/patterns/FilterBar';
import { ChoiceMenu, ChoiceList } from '@ume/ui/components/patterns/ChoiceMenu';
import SettingsModal from './Settings';
import SearchModal from './Search';
import { newProject, updateMeta, secretValues, maskText, liveItems, liveView, activeMembers, primaryClient, projectProgress, timeLeftLabel, myMember, canReview } from '../lib/model';
import { StatusPill, ProgressBar, timeTone } from './Overview';
import { putBlob, isQuotaError } from '../lib/blobs';
import { optimizeImageIfNeeded } from '../lib/files';
import { ProjectAvatar, ProjectCover } from './ProjectArt';
import { PROJECT_COLORS, PROJECT_STATUS, isActive } from '../lib/meta';
import { cx, fmtRel, uid, now, todayISO } from '../lib/util';

// Brainn tone → Ume hue, for the status swatches.
const STATUS_HUE = { sky: 'sky', amber: 'amber', emerald: 'green', neutral: null };

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
      <div className="text-xs font-medium text-muted-foreground mb-1">{label}</div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => ref.current.click()} className={cx('rounded-xl ring-1 ring-inset ring-border hover:ring-border-strong bg-background grid place-items-center text-muted-foreground overflow-hidden', wide ? 'h-16 flex-1' : 'h-16 w-16')}>
          {value ? <span className="text-xs text-foreground px-2 truncate">{value.name}</span> : <ImagePlus size={18} />}
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
          <span className="absolute right-3 bottom-2 text-xs text-muted-foreground">Preview — either image fills in for the other</span>
        </ProjectCover>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Space"><Select value={d.spaceId} onChange={set('spaceId')}><option value="">No space</option>{state.spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
          <Field label="Colour">
            <div className="flex gap-1.5 flex-wrap pt-1.5">{PROJECT_COLORS.map(c => <button key={c} type="button" onClick={() => setD(x => ({ ...x, color: c }))} className={cx('w-6 h-6 rounded-full transition', d.color === c && 'ring-2 ring-border ring-offset-2 ring-offset-[#1a1a1a]')} style={{ background: c }} />)}</div>
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
    <a href={`#/p/${p.id}/chat`} className="anim-up group block rounded-2xl overflow-hidden bg-card ring-1 ring-border hover:ring-border-strong hover:-translate-y-1 transition duration-300" style={{ animationDelay: i * 50 + 'ms' }}>
      <div className="relative">
        <ProjectCover p={p} className="h-24">
          <div className="absolute top-3 right-3 flex gap-1.5">
            {p.archived && <span className="text-xs px-2 py-0.5 rounded-full bg-modal-scrim text-warn-ink">Archived</span>}
            <StatusPill status={p.status} className="bg-modal-scrim backdrop-blur" />
          </div>
        </ProjectCover>
        <ProjectAvatar p={p} className="absolute left-5 bottom-0 translate-y-1/2 w-12 h-12 shadow-lg ring-2 ring-card" rounded="rounded-2xl" text="text-lg" />
      </div>
      <div className="p-5 pt-8">
        <h3 className="font-medium text-lg leading-tight group-hover:text-foreground">{p.name}</h3>
        <p className="text-sm text-muted-foreground mt-0.5 truncate">{p.client || primaryClient(p)?.name || 'No client yet'}</p>
        <div className="flex items-center gap-2 mt-3">
          <div className="flex -space-x-1.5">
            {members.slice(0, 5).map((m, k) => <span key={m.id} title={m.name} className={cx('w-6 h-6 rounded-full ring-2 ring-card grid place-items-center text-xs font-medium text-foreground', ['bg-orange', 'bg-violet', 'bg-green', 'bg-pink', 'bg-teal'][k % 5])}>{m.name[0]?.toUpperCase()}</span>)}
            {members.length > 5 && <span className="w-6 h-6 rounded-full ring-2 ring-card bg-grey-400 grid place-items-center text-xs">+{members.length - 5}</span>}
          </div>
          {!members.length && <span className="text-xs text-text-tertiary flex items-center gap-1"><Users size={12} />No one invited</span>}
          <span className={cx('ml-auto text-xs flex items-center gap-1', timeTone(p))}><CalendarClock size={12} />{timeLeftLabel(p)}</span>
        </div>
        {last && <p className="text-sm text-muted-foreground mt-3 line-clamp-2 min-h-[2.5rem]">{maskText(last.text, secretValues(p)).replace(/\*\*|~~|`/g, '') || last.attachments.map(a => a.name).join(', ')}</p>}
        <div className="flex items-center gap-2 mt-4"><ProgressBar value={prog.value} color={p.color} className="flex-1" /><span className="text-xs text-muted-foreground tabular-nums">{prog.value}%</span></div>
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ListTodo size={13} />{openTasks} open</span>
          <span className="flex items-center gap-1"><MessageSquare size={13} />{p.messages.length}</span>
          {pending > 0 && <span className="flex items-center gap-1 text-primary"><Sparkles size={13} />{pending} to review</span>}
          <span className="ml-auto">{last ? fmtRel(last.ts) : fmtRel(p.createdAt)}</span>
        </div>
      </div>
    </a>
  );
}

export default function Home({ space = 'all' }) {
  const { state, update, mode } = useStore();
  const member = mode === 'member';
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
    location.hash = `#/s/${s.id}`; setNewSpace(''); setModal(null);
  };

  // Filters: which projects (active or archived) and their status, as Ume choice menus;
  // on a phone they fold into the Filters sheet.
  const views = [{ value: 'active', label: 'Active' }, { value: 'archived', label: archivedCount ? `Archived · ${archivedCount}` : 'Archived' }];
  const statuses = Object.entries(PROJECT_STATUS).map(([k, v]) => ({ value: k, label: v.label, hue: STATUS_HUE[v.tone], swatch: STATUS_HUE[v.tone] ? undefined : 'var(--grey-400)' }));
  const pickStatus = v => setStatus(v ?? 'all');
  const filtersOn = (view !== 'active') + (status !== 'all');
  const clearFilters = () => { setView('active'); setStatus('all'); };

  return (
    <BrainShell onSettings={openSettings} onNewSpace={() => setModal('space')} onNewProject={() => setModal('project')}>
      <PageTopbar
        title={space === 'all' ? 'Your projects' : state.spaces.find(s => s.id === space)?.name}
        subtitle={member ? `Projects ${state.settings.ownerName} shared with you.` : 'Every client conversation, task, requirement and decision — remembered, linked, never lost.'}
        actions={<>
          <Button onClick={() => setModal('search')} title="Search inside every project"><Search />Search everything</Button>
          {!member && <Button variant="primary" onClick={() => setModal('project')}><Plus />New project</Button>}
        </>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            count={filtersOn}
            onClear={clearFilters}
            sheet={<>
              <FilterSection icon={Layers} title="Showing" id="home-view"><ChoiceList aria-labelledby="home-view" options={views} value={view} onChange={setView} /></FilterSection>
              <FilterSection icon={ListTodo} title="Status" id="home-status"><ChoiceList aria-labelledby="home-status" options={statuses} all="Any status" value={status === 'all' ? null : status} onChange={pickStatus} /></FilterSection>
            </>}
          >
            <ChoiceMenu title="Showing" options={views} value={view} onChange={setView} />
            <ChoiceMenu title="Status" options={statuses} all="Any status" value={status === 'all' ? null : status} onChange={pickStatus} />
            {filtersOn > 0 && <FilterClear onClick={clearFilters} />}
          </FilterBar>
          <div className="ms-auto flex w-full gap-2 sm:w-auto">
            <Input className="sm:w-56" leadingIcon={Search} value={q} onChange={e => setQ(e.target.value)} placeholder="Filter projects" aria-label="Filter projects" />
            <Button className="lg:hidden" variant="ghost" size="icon" onClick={() => setModal('search')} title="Search inside every project" aria-label="Search everything"><Search /></Button>
          </div>
        </div>
      </PageTopbar>

      <div className="px-4 py-6 sm:px-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((p, i) => <ProjectCard key={p.id} p={p} i={i} />)}
            {view === 'active' && !member && (
              <button onClick={() => setModal('project')} className="anim-up rounded-2xl border-2 border-dashed border-border hover:border-border-strong grid place-items-center min-h-[260px] text-muted-foreground hover:text-foreground transition">
                <div className="text-center"><Plus size={34} className="mx-auto" /><div className="mt-2 text-sm">New project</div></div>
              </button>
            )}
          </div>
          {member && !list.length && view === 'active' && <Empty icon={Layers} title="No projects yet" text={`When ${state.settings.ownerName} gives you access to a project, it shows up here.`} />}
          {view === 'archived' && !list.length && <Empty icon={Archive} title="No archived projects" text="Archive a finished project from its ⋯ menu. Its full history stays searchable." />}
      </div>

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
    </BrainShell>
  );
}
