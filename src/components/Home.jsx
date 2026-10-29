import { useRef, useState } from 'react';
import { Plus, Search, FolderPlus, FolderOpen, Layers, MessageSquare, ListTodo, Sparkles, Archive, ImagePlus, X } from '@/lib/icons';
import { useStore } from '../store';
import { Button, Modal, Field, Input, Textarea, Select, Empty, Badge } from './ui';
import { IconChip, InitialsAvatar } from '@ume/ui/components/patterns/IconChip';
import BrainShell, { PageHead } from './Shell';
import { FilterBar, FilterClear, FilterSection } from '@ume/ui/components/patterns/FilterBar';
import { ChoiceMenu, ChoiceList } from '@ume/ui/components/patterns/ChoiceMenu';
import SearchModal from './Search';
import { newProject, namesFor, updateMeta, secretValues, maskText, liveItems, liveView, primaryClient, myMember, canReview } from '../lib/model';
import { StatusPill } from './Overview';
import { putBlob, isQuotaError } from '../lib/blobs';
import { optimizeImageIfNeeded } from '../lib/files';
import { ProjectAvatar, ProjectCover } from './ProjectArt';
import { PROJECT_COLORS, PROJECT_STATUS } from '../lib/meta';
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

/** A project, as a card: its name and a way into its chat, a hairline, then its latest messages. */
function ProjectCard({ p: record, i, ownerName }) {
  const { mode, user } = useStore();
  const p = liveView(record);
  const names = namesFor(p, ownerName);
  const pending = canReview(mode === 'member' ? 'client' : 'owner', myMember(p, user)) ? p.suggestions.filter(s => s.state === 'pending').length : 0;
  const secrets = secretValues(p);
  const recent = p.messages.slice(-3).reverse();
  return (
    <a href={`#/p/${p.id}/chat`} className="anim-up group flex h-96 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card outline-none transition-[scale] duration-fast ease-out hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]" style={{ animationDelay: i * 40 + 'ms' }}>
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <ProjectAvatar p={p} className="size-7" rounded="rounded-lg" text="text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{p.name}</span>
        </span>
        {p.archived && <Badge tone="amber">Archived</Badge>}
        {pending > 0 && <Badge tone="sky" title={`${pending} suggestion${pending === 1 ? '' : 's'} to review`}><Sparkles />{pending}</Badge>}
        <MessageSquare aria-hidden className="size-5 shrink-0 text-icon-muted group-hover:text-foreground" />
      </header>
      {recent.length ? (
        <ul className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
          {recent.map(m => {
            const text = maskText(m.text, secrets).replace(/\*\*|~~|`/g, '') || m.attachments.map(a => a.name).join(', ') || 'Voice note';
            const who = names.msg(m);
            return (
              <li key={m.id} className="flex gap-3">
                <InitialsAvatar name={who} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2"><span className="truncate font-medium text-sm">{who}</span><span className="shrink-0 text-xs text-muted-foreground">{fmtRel(m.ts)}</span></span>
                  <span className="line-clamp-2 text-sm text-text-secondary">{text}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="grid flex-1 place-items-center px-5 text-sm text-muted-foreground">No messages yet.</p>
      )}
      <footer className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground">
        <span className="truncate">{p.client || primaryClient(p)?.name || 'No client yet'}</span>
        <span className="ms-auto shrink-0"><StatusPill status={p.status} /></span>
      </footer>
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
      <PageHead
        actions={<>
          <Button variant="ghost" size="icon" onClick={() => setModal('search')} title="Search inside every project" aria-label="Search everything"><Search /></Button>
          {!member && <Button onClick={() => setModal('space')}><FolderPlus />New space</Button>}
          {!member && <Button variant="primary" onClick={() => setModal('project')}><Plus />New project</Button>}
        </>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            count={filtersOn}
            onClear={clearFilters}
            sheet={<>
              {spaces.length > 0 && <FilterSection icon={FolderOpen} title="Space" id="home-space"><ChoiceList aria-labelledby="home-space" options={spaces} all="All spaces" value={space === 'all' ? null : space} onChange={pickSpace} /></FilterSection>}
              <FilterSection icon={Layers} title="Showing" id="home-view"><ChoiceList aria-labelledby="home-view" options={views} value={view} onChange={setView} /></FilterSection>
              <FilterSection icon={ListTodo} title="Status" id="home-status"><ChoiceList aria-labelledby="home-status" options={statuses} all="Any status" value={status === 'all' ? null : status} onChange={pickStatus} /></FilterSection>
            </>}
          >
            <ChoiceMenu title="Space" options={spaces} all="All spaces" value={space === 'all' ? null : space} onChange={pickSpace} />
            <ChoiceMenu title="Showing" options={views} value={view} onChange={setView} />
            <ChoiceMenu title="Status" options={statuses} all="Any status" value={status === 'all' ? null : status} onChange={pickStatus} />
            {filtersOn > 0 && <FilterClear onClick={clearFilters} />}
          </FilterBar>
          <Input className="ms-auto w-full sm:w-56" leadingIcon={Search} value={q} onChange={e => setQ(e.target.value)} placeholder="Filter projects" aria-label="Filter projects" />
        </div>
      </PageHead>

      <div className="grid gap-5 sm:grid-cols-2">
        {list.map((p, i) => <ProjectCard key={p.id} p={p} i={i} ownerName={state.settings.ownerName || 'You'} />)}
        {view === 'active' && !member && (
          <button onClick={() => setModal('project')} className="anim-up grid h-96 place-items-center rounded-2xl border border-dashed border-border-strong text-text-secondary outline-none transition-[scale] duration-fast ease-out hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
            <span className="flex flex-col items-center gap-3"><IconChip icon={Plus} hue="brand" /><span className="font-medium text-sm">New project</span></span>
          </button>
        )}
      </div>
      {member && !list.length && view === 'active' && <Empty icon={Layers} title="No projects yet" text={`When ${state.settings.ownerName} gives you access to a project, it shows up here.`} />}
      {view === 'archived' && !list.length && <Empty icon={Archive} title="No archived projects" text="Archive a finished project from its ⋯ menu. Its full history stays searchable." />}

      {modal === 'project' && <ProjectFormModal spaceId={space === 'all' ? undefined : space} onClose={() => setModal(null)} />}
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
