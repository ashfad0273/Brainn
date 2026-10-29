import { useRef, useState } from 'react';
import { Plus, Search, FolderPlus, FolderOpen, Layers, ListTodo, Archive, ImagePlus, X } from '@/lib/icons';
import { useStore } from '../store';
import { Button, Modal, Field, Input, Textarea, Select, Empty, Badge } from './ui';
import { IconChip } from '@ume/ui/components/patterns/IconChip';
import BrainShell from './Shell';
import { ProjectRow, useProjectList } from './Rail';
import { FilterBar, FilterSection } from '@ume/ui/components/patterns/FilterBar';
import { ChoiceList } from '@ume/ui/components/patterns/ChoiceMenu';
import { newProject, namesFor, projectHealth, timeLeftLabel, updateMeta, secretValues, maskText, liveItems, liveView, primaryClient } from '../lib/model';
import { timeTone } from './Overview';
import { putBlob, isQuotaError } from '../lib/blobs';
import { optimizeImageIfNeeded } from '../lib/files';
import { ProjectAvatar, ProjectCover } from './ProjectArt';
import { COLOR, PROJECT_COLORS, PROJECT_STATUS } from '../lib/meta';
import { cx, uid, now, todayISO } from '../lib/util';

// Brainn tone → Ume hue, for the status swatches.
const STATUS_HUE = { sky: 'sky', amber: 'amber', emerald: 'green', neutral: null };


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

/** A project, as a card: who it's for, how it's doing and when it's due, and the last thing said. */
function ProjectCard({ p: record, i, ownerName }) {
  const p = liveView(record);
  const health = projectHealth(p);
  const last = p.messages[p.messages.length - 1];
  const who = last && namesFor(p, ownerName).msg(last).split(' ')[0];
  const lastText = last && (maskText(last.text, secretValues(p)).replace(/\*\*|~~|`/g, '') || last.attachments.map(a => a.name).join(', ') || 'Voice note');
  return (
    <a href={`#/p/${p.id}/chat`} className="anim-up flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card outline-none transition-[scale] duration-fast ease-out hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]" style={{ animationDelay: i * 40 + 'ms' }}>
      <div className="flex items-center gap-3">
        <ProjectAvatar p={p} className="size-10" rounded="rounded-xl" text="text-sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{p.name}</span>
          <span className="block truncate text-sm text-text-secondary">{p.client || primaryClient(p)?.name || 'No client yet'}</span>
        </span>
        {p.archived && <Badge tone="amber">Archived</Badge>}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden className={cx('size-2 shrink-0 rounded-full', COLOR[health.tone].dot)} />
        <span className="font-medium">{health.label}</span>
        <span className="text-text-tertiary">·</span>
        <span className={cx('truncate', timeTone(p))}>{timeLeftLabel(p)}</span>
      </div>
      <p className="truncate text-sm text-text-secondary">{last ? <><span className="font-medium text-foreground">{who}:</span> {lastText}</> : 'No messages yet.'}</p>
    </a>
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
  const [newSpace, setNewSpace] = useState('');
  const rows = new Map(useProjectList().map(x => [x.p.id, x]));

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

  // Filters: the space, which projects (active or archived) and their status, as Ume choice
  // menus; on a phone they fold into the Filters sheet.
  const spaces = member ? [] : state.spaces.map(s => ({ value: s.id, label: s.name }));
  const pickSpace = v => setSpace(v ?? 'all');
  const views = [{ value: 'active', label: 'Active' }, { value: 'archived', label: archivedCount ? `Archived · ${archivedCount}` : 'Archived' }];
  const statuses = Object.entries(PROJECT_STATUS).map(([k, v]) => ({ value: k, label: v.label, hue: STATUS_HUE[v.tone], swatch: STATUS_HUE[v.tone] ? undefined : 'var(--grey-400)' }));
  const pickStatus = v => setStatus(v ?? 'all');
  const filtersOn = (space !== 'all') + (view !== 'active') + (status !== 'all');
  const clearFilters = () => { setSpace('all'); setView('active'); setStatus('all'); };

  return (
    <BrainShell>
      {/* One row: find a project, filter, add one. Everything else is in the Filters sheet. */}
      <div className="mb-5 flex items-center gap-2">
        <Input className="min-w-0 flex-1 sm:max-w-72" leadingIcon={Search} value={q} onChange={e => setQ(e.target.value)} placeholder="Find a project" aria-label="Find a project" />
        <FilterBar
          phone
          className="ms-auto flex-nowrap"
          count={filtersOn}
          onClear={clearFilters}
          sheet={<>
            {!member && (
              <FilterSection icon={FolderOpen} title="Space" id="home-space">
                {spaces.length > 0 && <ChoiceList aria-labelledby="home-space" options={spaces} all="All spaces" value={space === 'all' ? null : space} onChange={pickSpace} />}
                <Button variant="ghost" className="self-start" onClick={() => setModal('space')}><FolderPlus />New space</Button>
              </FilterSection>
            )}
            <FilterSection icon={Layers} title="Showing" id="home-view"><ChoiceList aria-labelledby="home-view" options={views} value={view} onChange={setView} /></FilterSection>
            <FilterSection icon={ListTodo} title="Status" id="home-status"><ChoiceList aria-labelledby="home-status" options={statuses} all="Any status" value={status === 'all' ? null : status} onChange={pickStatus} /></FilterSection>
          </>}
        >{null}</FilterBar>
        {!member && <Button variant="primary" onClick={() => setModal('project')}><Plus /><span className="max-sm:sr-only">New project</span></Button>}
      </div>

      {/* Desktop: a card per project. Phone: the list, like Slack, latest conversation first. */}
      <div className="grid gap-5 sm:grid-cols-2 max-lg:hidden">
        {list.map((p, i) => <ProjectCard key={p.id} p={p} i={i} ownerName={state.settings.ownerName || 'You'} />)}
      </div>
      <div className="-mx-2.5 flex flex-col lg:hidden">
        {list.map(p => rows.get(p.id) && <ProjectRow key={p.id} {...rows.get(p.id)} />)}
      </div>
      {member && !list.length && view === 'active' && <Empty icon={Layers} title="No projects yet" text={`When ${state.settings.ownerName} gives you access to a project, it shows up here.`} />}
      {view === 'archived' && !list.length && <Empty icon={Archive} title="No archived projects" text="Archive a finished project from its ⋯ menu. Its full history stays searchable." />}

      {modal === 'project' && <ProjectFormModal spaceId={space === 'all' ? undefined : space} onClose={() => setModal(null)} />}
      {modal === 'space' && (
        <Modal title="New space" sub="Group projects — by client type, team, or however you work." onClose={() => setModal(null)}>
          <form onSubmit={addSpace} className="flex gap-2"><Input autoFocus value={newSpace} onChange={e => setNewSpace(e.target.value)} placeholder="e.g. Retainer clients" /><Button type="submit" variant="primary">Create</Button></form>
        </Modal>
      )}
    </BrainShell>
  );
}
