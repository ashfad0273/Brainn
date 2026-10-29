import { useMemo, useRef, useState } from 'react';
import {
  Search, Upload, Folder, FolderPlus, LayoutGrid, List as ListIcon, Download, ExternalLink, MessageSquareQuote,
  Pencil, Trash2, FolderInput, ChevronRight, FileText, Image as ImageIcon, Mic, Film, Link2, Files, MoreHorizontal,
} from '@/lib/icons';
import { useStore } from '../store';
import BrainShell, { PageHead } from './Shell';
import { FilterClear } from '@ume/ui/components/patterns/FilterBar';
import { ChoiceMenu } from '@ume/ui/components/patterns/ChoiceMenu';
import { IconChip } from '@ume/ui/components/patterns/IconChip';
import { Button, Empty, Input, Modal, Field, Select, Menu, MenuItem } from './ui';
import { ImageThumb, Lightbox, useDownload } from './Viewer';
import { ProjectAvatar } from './ProjectArt';
import { addMessage, editItem, deleteItem, updateMeta, liveView, myMember } from '../lib/model';
import { toAttachment } from '../lib/files';
import { hasFile } from '../lib/blobs';
import { cx, fmtSize, fmtRel } from '../lib/util';

const KINDS = [
  ['all', 'All', Files], ['image', 'Images', ImageIcon], ['doc', 'Documents', FileText],
  ['audio', 'Audio', Mic], ['video', 'Video', Film], ['link', 'Links', Link2],
];
function kindOf(f) {
  if (f.it.kind === 'link') return 'link';
  const mime = f.it.file?.mime || '', name = (f.it.file?.name || f.it.title || '').toLowerCase();
  if (f.it.kind === 'voice' || mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|svg)$/.test(name)) return 'image';
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/.test(name)) return 'video';
  return 'doc';
}
const ICON = { image: ImageIcon, doc: FileText, audio: Mic, video: Film, link: Link2 };
// Each kind of file in its own Ume hue, so a list reads at a glance.
const KIND_TINT = { image: 'bg-violet-soft text-violet', doc: 'bg-blue-soft text-blue', audio: 'bg-orange-soft text-orange', video: 'bg-pink-soft text-pink', link: 'bg-teal-soft text-teal' };

/** Every file and link across the workspace (or the projects shared with you), grouped by project and folder. */
export default function FileManager() {
  const { state, mutate, toast, mode, user } = useStore();
  const member = mode === 'member';
  const [pid, setPid] = useState('all');
  const [folder, setFolder] = useState(null); // null = every folder
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [grid, setGrid] = useState(() => { try { return localStorage.getItem('pb-files-view') === 'grid'; } catch { return false; } });
  const [modal, setModal] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef();
  const dl = useDownload();

  const projects = useMemo(() => state.projects.filter(p => !p.archived).map(liveView), [state.projects]);
  const all = useMemo(() => projects.flatMap(p => {
    const att = Object.fromEntries(p.messages.flatMap(m => m.attachments.map(a => [a.id, a])));
    return p.items.filter(i => i.type === 'file').map(it => ({ it, p, a: it.file && att[it.file.attachmentId] }));
  }).map(f => ({ ...f, kind: kindOf(f) })).sort((a, b) => b.it.createdAt - a.it.createdAt), [projects]);

  const project = pid !== 'all' ? projects.find(p => p.id === pid) : null;
  const folders = project ? [...new Set([...(project.fileFolders || []), ...all.filter(f => f.p.id === pid && f.it.folder).map(f => f.it.folder)])].sort() : [];
  const list = all.filter(f => (pid === 'all' || f.p.id === pid) && (folder === null || (f.it.folder || '') === folder) && (kind === 'all' || f.kind === kind)
    && (!q || `${f.it.title} ${f.it.category} ${f.p.name} ${f.it.folder || ''}`.toLowerCase().includes(q.toLowerCase())));
  const size = list.reduce((n, f) => n + (f.it.file?.size || 0), 0);

  // only the owner reorganises; anyone in a project can add files to it
  const canEdit = !member;
  const me = p => (member ? myMember(p, user) : null);
  const mutP = (p, fn) => mutate(p.id, fn);

  const upload = async files => {
    if (!project) return toast('Pick a project first', 'error');
    const res = await Promise.allSettled([...files].map(f => toAttachment(f)));
    res.filter(r => r.status === 'rejected').forEach(r => toast(r.reason.message, 'error'));
    const atts = res.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!atts.length) return;
    const m = me(project);
    mutP(project, q => {
      const msg = addMessage(q, { from: member ? 'client' : 'owner', memberId: m?.id || null, text: '', attachments: atts });
      if (folder) q.items.filter(i => i.sourceMsg === msg.id).forEach(i => { i.folder = folder; });
    });
    toast(`Uploaded ${atts.length} file${atts.length > 1 ? 's' : ''} to ${project.name}${folder ? ' / ' + folder : ''} — also posted in its chat`);
  };

  const open = f => {
    if (f.kind === 'link') return window.open(f.it.value, '_blank', 'noopener');
    if (f.kind === 'image' && hasFile(f.a)) return setLightbox(f.a);
    if (hasFile(f.a)) return dl(f.a);
    toast('No stored copy of this file', 'error');
  };

  const actions = f => (
    <Menu trigger={t => <button onClick={e => { e.stopPropagation(); t(); }} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-field-hover" title="More"><MoreHorizontal size={15} /></button>}>
      {f.kind === 'link' ? <MenuItem icon={ExternalLink} onClick={() => open(f)}>Open link</MenuItem> : hasFile(f.a) && <MenuItem icon={Download} onClick={() => dl(f.a)}>Download</MenuItem>}
      {f.it.sourceMsg && <MenuItem icon={MessageSquareQuote} onClick={() => { location.hash = `#/p/${f.p.id}/chat/m/${f.it.sourceMsg}`; }}>Show in chat</MenuItem>}
      {canEdit && <MenuItem icon={Pencil} onClick={() => setModal({ kind: 'rename', f, value: f.it.title })}>Rename</MenuItem>}
      {canEdit && <MenuItem icon={FolderInput} onClick={() => setModal({ kind: 'move', f, value: f.it.folder || '' })}>Move to folder</MenuItem>}
      {canEdit && <MenuItem icon={Trash2} tone="danger" onClick={() => setModal({ kind: 'delete', f })}>Delete</MenuItem>}
    </Menu>
  );

  const thumb = (f, cls) => {
    const I = ICON[f.kind];
    if (f.kind === 'image' && hasFile(f.a)) return <ImageThumb a={f.a} className={cx('block cursor-zoom-in', cls)} imgClass="w-full h-full object-cover" />;
    return <div className={cx('grid place-items-center', KIND_TINT[f.kind], cls)}><I size={cls.includes('h-28') ? 28 : 16} /></div>;
  };

  // Where you are, like a file browser: the top level lists each project as a folder; inside a
  // project, its folders come first, then the files not in one; inside a folder, its files.
  // A search or a type filter shows a flat list of everything that matches, with each file's place.
  const flat = !!q || kind !== 'all';
  const here = flat ? list : project ? list.filter(f => (f.it.folder || '') === (folder || '')) : [];
  const folderRows = flat ? [] : project
    ? (folder ? [] : folders.map(fd => ({ key: fd, name: fd, files: all.filter(f => f.p.id === pid && f.it.folder === fd), go: () => setFolder(fd) })))
    : projects.map(p => ({ key: p.id, name: p.name, p, files: all.filter(f => f.p.id === p.id), go: () => { setPid(p.id); setFolder(null); } }));
  const shown = here.length + folderRows.length;
  const goRoot = () => { setPid('all'); setFolder(null); };
  const kindOptions = KINDS.slice(1).map(([k, l]) => ({ value: k, label: l }));
  const pickKind = v => setKind(v ?? 'all');
  const toggleView = () => setGrid(g => { try { localStorage.setItem('pb-files-view', g ? 'list' : 'grid'); } catch { /* private mode */ } return !g; });

  const crumbs = (
    <nav aria-label="Folder" className="flex min-w-0 items-center gap-1 font-medium text-xl">
      {project ? <button type="button" onClick={goRoot} className="shrink-0 text-text-secondary hover:text-foreground">Files</button> : 'Files'}
      {project && <><ChevronRight className="size-4 shrink-0 text-icon-muted" />{folder ? <button type="button" onClick={() => setFolder(null)} className="truncate text-text-secondary hover:text-foreground">{project.name}</button> : <span className="truncate">{project.name}</span>}</>}
      {project && folder && <><ChevronRight className="size-4 shrink-0 text-icon-muted" /><span className="truncate">{folder}</span></>}
    </nav>
  );
  const latest = files => files.reduce((t, f) => Math.max(t, f.it.createdAt), 0);
  const where = f => `${f.p.name}${f.it.folder ? ` / ${f.it.folder}` : ''}`;

  return (
    <BrainShell>
      <PageHead
        title={crumbs}
        subtitle={project ? 'Files shared in this project’s chat, and anything you upload here.' : 'Every file and link shared in your projects.'}
        actions={<>
          {project && canEdit && !folder && <Button className="max-sm:hidden" onClick={() => setModal({ kind: 'folder', value: '' })}><FolderPlus />New folder</Button>}
          <input ref={fileRef} type="file" multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
          <Button variant="primary" disabled={!project} onClick={() => fileRef.current.click()} title={project ? `Upload to ${project.name}${folder ? ' / ' + folder : ''}` : 'Open a project to upload into it'}><Upload />Upload</Button>
        </>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <ChoiceMenu title="Type" options={kindOptions} all="All types" value={kind === 'all' ? null : kind} onChange={pickKind} />
          {kind !== 'all' && <FilterClear onClick={() => setKind('all')} />}
          <span className="text-label-mono text-muted-foreground">{shown} item{shown === 1 ? '' : 's'}{flat && size ? ` · ${fmtSize(size)}` : ''}</span>
          <div className="ms-auto flex w-full items-center gap-2 sm:w-auto">
            <Input className="sm:w-64" leadingIcon={Search} value={q} onChange={e => setQ(e.target.value)} placeholder="Search all files" aria-label="Search all files" />
            <Button variant="ghost" size="icon" onClick={toggleView} title={grid ? 'List view' : 'Grid view'} aria-label={grid ? 'List view' : 'Grid view'}>{grid ? <ListIcon /> : <LayoutGrid />}</Button>
          </div>
        </div>
      </PageHead>

      <div
        onDragOver={e => { if (project && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
        onDrop={e => { if (!project) return; e.preventDefault(); upload(e.dataTransfer.files); }}>
        {!shown && (flat
          ? <Empty icon={Search} title="Nothing matches" text="Try another name or type, or clear the search." />
          : project
            ? <Empty icon={Upload} title={folder ? 'This folder is empty' : 'No files here yet'} text="Drop files here or use Upload. They're also posted in the project's chat." />
            : <Empty icon={Files} title="No projects yet" text="Each project's files show up here as a folder." />)}

        {shown > 0 && (grid ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {folderRows.map(r => (
              <button key={r.key} type="button" onClick={r.go} className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-card outline-none transition-[scale] duration-fast ease-out hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
                {r.p ? <ProjectAvatar p={r.p} className="size-10" rounded="rounded-xl" text="text-sm" /> : <IconChip icon={Folder} hue="blue" />}
                <span className="w-full min-w-0"><span className="block truncate font-medium text-sm">{r.name}</span><span className="block text-xs text-muted-foreground">{r.files.length} file{r.files.length === 1 ? '' : 's'}</span></span>
              </button>
            ))}
            {here.map(f => (
              <div key={f.it.id} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-card hover:border-border-strong">
                <div onClick={() => open(f)} className="cursor-pointer">{thumb(f, 'h-28 w-full')}</div>
                <div className="flex items-start gap-1 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium" title={f.it.title}>{f.it.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{flat ? where(f) : `${f.it.file?.size ? fmtSize(f.it.file.size) + ' · ' : ''}${fmtRel(f.it.createdAt)}`}</div>
                  </div>
                  {actions(f)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-4 py-2.5 text-label-mono text-muted-foreground sm:grid-cols-[1fr_7rem_6rem_2rem]">
              <span>Name</span><span className="max-sm:hidden">Modified</span><span className="text-right max-sm:hidden">Size</span><span />
            </div>
            <ul className="divide-y divide-border">
              {folderRows.map(r => (
                <li key={r.key}>
                  <button type="button" onClick={r.go} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5 text-left outline-none hover:bg-field-hover focus-visible:bg-field-hover sm:grid-cols-[1fr_7rem_6rem_2rem]">
                    <span className="flex min-w-0 items-center gap-3">
                      {r.p ? <ProjectAvatar p={r.p} className="size-9" rounded="rounded-xl" text="text-xs" /> : <IconChip icon={Folder} hue="blue" />}
                      <span className="truncate font-medium text-sm">{r.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground max-sm:hidden">{r.files.length ? fmtRel(latest(r.files)) : '—'}</span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground max-sm:hidden">{r.files.length} file{r.files.length === 1 ? '' : 's'}</span>
                    <ChevronRight className="size-4 justify-self-end text-icon-muted" />
                  </button>
                </li>
              ))}
              {here.map(f => (
                <li key={f.it.id} className="group grid grid-cols-[1fr_auto] items-center gap-4 px-4 py-2.5 hover:bg-field-hover sm:grid-cols-[1fr_7rem_6rem_2rem]">
                  <button type="button" onClick={() => open(f)} className="flex min-w-0 items-center gap-3 text-left outline-none">
                    <span className="size-9 shrink-0 overflow-hidden rounded-xl">{thumb(f, 'size-9')}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{f.it.title}</span>
                      {flat && <span className="block truncate text-xs text-muted-foreground">{where(f)}</span>}
                    </span>
                  </button>
                  <span className="text-xs text-muted-foreground max-sm:hidden">{fmtRel(f.it.createdAt)}</span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground max-sm:hidden">{f.it.file?.size ? fmtSize(f.it.file.size) : f.kind === 'link' ? 'Link' : '—'}</span>
                  <span className="justify-self-end sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">{actions(f)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {lightbox && <Lightbox a={lightbox} onClose={() => setLightbox(null)} />}
      {modal?.kind === 'rename' && (
        <Modal title="Rename" onClose={() => setModal(null)} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => { if (modal.value.trim()) mutP(modal.f.p, q => editItem(q, 'owner', modal.f.it.id, { title: modal.value.trim() })); setModal(null); }}>Rename</Button></>}>
          <Input autoFocus value={modal.value} onChange={e => setModal(m => ({ ...m, value: e.target.value }))} />
        </Modal>
      )}
      {modal?.kind === 'move' && (() => {
        const p = modal.f.p;
        const opts = [...new Set([...(p.fileFolders || []), ...all.filter(f => f.p.id === p.id && f.it.folder).map(f => f.it.folder)])].sort();
        return (
          <Modal title={`Move “${modal.f.it.title}”`} onClose={() => setModal(null)} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => {
            const fd = modal.value.trim();
            mutP(p, q => { editItem(q, 'owner', modal.f.it.id, { folder: fd }); if (fd && !(q.fileFolders || []).includes(fd)) updateMeta(q, 'owner', { fileFolders: [...(q.fileFolders || []), fd] }, 'files.folder'); });
            setModal(null);
          }}>Move</Button></>}>
            <Field label={`Folder in ${p.name}`} hint="Pick one or type a new name. Empty = not in a folder.">
              <Input autoFocus list="pb-folders" value={modal.value} onChange={e => setModal(m => ({ ...m, value: e.target.value }))} placeholder="e.g. Final deliverables" />
              <datalist id="pb-folders">{opts.map(o => <option key={o} value={o} />)}</datalist>
            </Field>
          </Modal>
        );
      })()}
      {modal?.kind === 'folder' && project && (
        <Modal title={`New folder in ${project.name}`} onClose={() => setModal(null)} footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" onClick={() => {
          const fd = modal.value.trim();
          if (fd && !folders.includes(fd)) mutP(project, q => updateMeta(q, 'owner', { fileFolders: [...(q.fileFolders || []), fd] }, 'files.folder'));
          if (fd) setFolder(fd);
          setModal(null);
        }}>Create</Button></>}>
          <Input autoFocus value={modal.value} onChange={e => setModal(m => ({ ...m, value: e.target.value }))} placeholder="e.g. Brand assets" />
        </Modal>
      )}
      {modal?.kind === 'delete' && (
        <Modal title={`Delete “${modal.f.it.title}”?`} sub="It disappears from the files, the chat links and the AI’s context. Like every record, it stays in the project’s history (Timeline → raw JSON)." onClose={() => setModal(null)}
          footer={<><Button variant="ghost" onClick={() => setModal(null)}>Keep it</Button><Button variant="danger" onClick={() => { mutP(modal.f.p, q => deleteItem(q, 'owner', modal.f.it.id, 'Deleted from the file manager')); toast('Deleted — kept in the history'); setModal(null); }}><Trash2 size={14} />Delete</Button></>} />
      )}
    </BrainShell>
  );
}
