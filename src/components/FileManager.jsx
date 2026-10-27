import { useMemo, useRef, useState } from 'react';
import {
  Search, Upload, Folder, FolderPlus, LayoutGrid, List as ListIcon, Download, ExternalLink, MessageSquareQuote,
  Pencil, Trash2, FolderInput, FileText, Image as ImageIcon, Mic, Film, Link2, Files, MoreHorizontal,
} from '@/lib/icons';
import { useStore } from '../store';
import BrainShell from './Shell';
import { PageTopbar } from '@ume/ui/components/shell/PageTopbar';
import { FilterBar, FilterClear, FilterSection } from '@ume/ui/components/patterns/FilterBar';
import { ChoiceMenu, ChoiceList } from '@ume/ui/components/patterns/ChoiceMenu';
import SettingsModal from './Settings';
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

/** Every file and link across the workspace (or the projects shared with you), grouped by project and folder. */
export default function FileManager() {
  const { state, mutate, toast, mode, user } = useStore();
  const member = mode === 'member';
  const [settings, setSettings] = useState(null);
  const [pid, setPid] = useState('all');
  const [folder, setFolder] = useState(null); // null = every folder
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [grid, setGrid] = useState(() => { try { return localStorage.getItem('pb-files-view') !== 'list'; } catch { return true; } });
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
    return <div className={cx('grid place-items-center bg-teal-soft text-teal', cls)}><I size={cls.includes('h-28') ? 28 : 16} /></div>;
  };

  // Filters: which project and which kind of file, as Ume choice menus; on a phone they fold into the Filters sheet.
  const projectOptions = projects.map(p => ({ value: p.id, label: `${p.name} · ${all.filter(f => f.p.id === p.id).length}`, swatch: p.color }));
  const kindOptions = KINDS.slice(1).map(([k, l]) => ({ value: k, label: l }));
  const pickProject = v => { setPid(v ?? 'all'); setFolder(null); };
  const pickKind = v => setKind(v ?? 'all');
  const filtersOn = (pid !== 'all') + (kind !== 'all');
  const clearFilters = () => { pickProject(null); setKind('all'); };

  return (
    <BrainShell onSettings={t => setSettings(t)}>
      <PageTopbar
        title="Files"
        subtitle="Every file and link shared in your projects, in one place."
        keepActionsOnPhone
        actions={<>
            <Button variant="ghost" size="icon" onClick={() => setGrid(g => { try { localStorage.setItem('pb-files-view', g ? 'list' : 'grid'); } catch { /* private mode */ } return !g; })} title={grid ? 'List view' : 'Grid view'}>{grid ? <ListIcon size={17} /> : <LayoutGrid size={17} />}</Button>
            <input ref={fileRef} type="file" multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
            <Button variant="primary" onClick={() => (project ? fileRef.current.click() : toast('Pick a project to upload into', 'error'))} title={project ? `Upload to ${project.name}${folder ? ' / ' + folder : ''}` : 'Pick a project first'}><Upload size={15} />Upload</Button>
        </>}
      >
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            count={filtersOn}
            onClear={clearFilters}
            sheet={<>
              <FilterSection icon={Folder} title="Project" id="files-project"><ChoiceList aria-labelledby="files-project" options={projectOptions} all="All projects" value={pid === 'all' ? null : pid} onChange={pickProject} /></FilterSection>
              <FilterSection icon={Files} title="Type" id="files-kind"><ChoiceList aria-labelledby="files-kind" options={kindOptions} all="All types" value={kind === 'all' ? null : kind} onChange={pickKind} /></FilterSection>
            </>}
          >
            <ChoiceMenu title="Project" options={projectOptions} all="All projects" value={pid === 'all' ? null : pid} onChange={pickProject} />
            <ChoiceMenu title="Type" options={kindOptions} all="All types" value={kind === 'all' ? null : kind} onChange={pickKind} />
            {filtersOn > 0 && <FilterClear onClick={clearFilters} />}
          </FilterBar>
          <span className="text-label-mono text-muted-foreground">{list.length} item{list.length === 1 ? '' : 's'}{size ? ` · ${fmtSize(size)}` : ''}</span>
          <Input className="ms-auto w-full sm:w-64" leadingIcon={Search} value={q} onChange={e => setQ(e.target.value)} placeholder="Search files" aria-label="Search files" />
        </div>
          {project && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setFolder(null)} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', folder === null ? 'bg-primary-soft ring-blue-ring text-primary' : 'ring-border text-muted-foreground hover:text-foreground')}><Folder size={12} />Everything</button>
              <button onClick={() => setFolder('')} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', folder === '' ? 'bg-primary-soft ring-blue-ring text-primary' : 'ring-border text-muted-foreground hover:text-foreground')}><Folder size={12} />Not in a folder</button>
              {folders.map(fd => <button key={fd} onClick={() => setFolder(fd)} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', folder === fd ? 'bg-primary-soft ring-blue-ring text-primary' : 'ring-border text-foreground hover:text-foreground')}><Folder size={12} />{fd}</button>)}
              {canEdit && <button onClick={() => setModal({ kind: 'folder', value: '' })} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"><FolderPlus size={12} />New folder</button>}
            </div>
          )}
      </PageTopbar>

      <div className="px-4 py-6 sm:px-6"
          onDragOver={e => { if (project && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={e => { if (!project) return; e.preventDefault(); upload(e.dataTransfer.files); }}>
          {!list.length && <Empty icon={Files} title={all.length ? 'Nothing matches' : 'No files yet'} text={all.length ? 'Try another project, folder or type.' : 'Files and links shared in any project chat appear here. Pick a project and upload to add some.'} />}
          {grid ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {list.map(f => (
                <div key={f.it.id} className="group rounded-2xl bg-card ring-1 ring-border hover:ring-border-strong overflow-hidden transition">
                  <div onClick={() => open(f)} className="cursor-pointer">{thumb(f, 'h-28 w-full')}</div>
                  <div className="p-2.5">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate" title={f.it.title}>{f.it.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{f.p.name}{f.it.folder ? ` / ${f.it.folder}` : ''}</div>
                      </div>
                      {actions(f)}
                    </div>
                    <div className="text-xs text-text-tertiary mt-1">{f.it.file?.size ? fmtSize(f.it.file.size) + ' · ' : ''}{fmtRel(f.it.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-2xl ring-1 ring-border overflow-hidden">
              {list.map(f => (
                <div key={f.it.id} className="flex items-center gap-3 px-3 py-2 hover:bg-field-hover">
                  <button onClick={() => open(f)} className="shrink-0 w-9 h-9 rounded-lg overflow-hidden">{thumb(f, 'w-9 h-9')}</button>
                  <button onClick={() => open(f)} className="min-w-0 flex-1 text-left">
                    <div className="text-sm truncate">{f.it.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{f.p.name}{f.it.folder ? ` / ${f.it.folder}` : ''} · {f.it.category || 'Other'}</div>
                  </button>
                  <span className="hidden sm:block text-xs text-muted-foreground w-20 text-right">{f.it.file?.size ? fmtSize(f.it.file.size) : f.kind === 'link' ? 'link' : ''}</span>
                  <span className="hidden md:block text-xs text-text-tertiary w-24 text-right">{fmtRel(f.it.createdAt)}</span>
                  {actions(f)}
                </div>
              ))}
            </div>
          )}
      </div>

      {lightbox && <Lightbox a={lightbox} onClose={() => setLightbox(null)} />}
      {settings && <SettingsModal initialTab={settings} onClose={() => setSettings(null)} />}
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
