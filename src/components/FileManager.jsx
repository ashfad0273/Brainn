import { useMemo, useRef, useState } from 'react';
import {
  Search, Upload, Folder, FolderPlus, LayoutGrid, List as ListIcon, Download, ExternalLink, MessageSquareQuote,
  Pencil, Trash2, FolderInput, FileText, Image as ImageIcon, Mic, Film, Link2, Files, ArrowLeft, MoreHorizontal,
} from 'lucide-react';
import { useStore } from '../store';
import { Sidebar } from './Home';
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
    <Menu trigger={t => <button onClick={e => { e.stopPropagation(); t(); }} className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/10" title="More"><MoreHorizontal size={15} /></button>}>
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
    return <div className={cx('grid place-items-center bg-gradient-to-br from-cyan-500/10 to-transparent text-cyan-300/70', cls)}><I size={cls.includes('h-28') ? 28 : 16} /></div>;
  };

  return (
    <div className="h-full flex">
      <Sidebar active="files" onSettings={t => setSettings(t)} />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 border-b border-white/[.06] px-4 md:px-8 py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <a href="#/" className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-neutral-400"><ArrowLeft size={18} /></a>
            <h1 className="text-2xl font-semibold tracking-tight flex-1">Files</h1>
            <div className="flex items-center gap-2 bg-[#181818] ring-1 ring-white/[.08] rounded-xl px-3 focus-within:ring-sky-500/60 w-full sm:w-64 order-last sm:order-none">
              <Search size={15} className="text-neutral-500" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search files" className="bg-transparent outline-none py-2 text-sm w-full" />
            </div>
            <Button variant="ghost" size="icon" onClick={() => setGrid(g => { try { localStorage.setItem('pb-files-view', g ? 'list' : 'grid'); } catch { /* private mode */ } return !g; })} title={grid ? 'List view' : 'Grid view'}>{grid ? <ListIcon size={17} /> : <LayoutGrid size={17} />}</Button>
            <input ref={fileRef} type="file" multiple hidden onChange={e => { upload(e.target.files); e.target.value = ''; }} />
            <Button variant="primary" onClick={() => (project ? fileRef.current.click() : toast('Pick a project to upload into', 'error'))} title={project ? `Upload to ${project.name}${folder ? ' / ' + folder : ''}` : 'Pick a project first'}><Upload size={15} />Upload</Button>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button onClick={() => { setPid('all'); setFolder(null); }} className={cx('shrink-0 px-3 py-1.5 rounded-lg text-sm', pid === 'all' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white')}>All projects</button>
            {projects.map(p => (
              <button key={p.id} onClick={() => { setPid(p.id); setFolder(null); }} className={cx('shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm', pid === p.id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white')}>
                <ProjectAvatar p={p} className="w-5 h-5" rounded="rounded-md" text="text-[10px]" />{p.name}<span className="text-xs text-neutral-600">{all.filter(f => f.p.id === p.id).length}</span>
              </button>
            ))}
          </div>
          {project && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={() => setFolder(null)} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', folder === null ? 'bg-sky-500/15 ring-sky-500/40 text-sky-200' : 'ring-white/10 text-neutral-400 hover:text-white')}><Folder size={12} />Everything</button>
              <button onClick={() => setFolder('')} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', folder === '' ? 'bg-sky-500/15 ring-sky-500/40 text-sky-200' : 'ring-white/10 text-neutral-400 hover:text-white')}><Folder size={12} />Not in a folder</button>
              {folders.map(fd => <button key={fd} onClick={() => setFolder(fd)} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset', folder === fd ? 'bg-sky-500/15 ring-sky-500/40 text-sky-200' : 'ring-white/10 text-neutral-300 hover:text-white')}><Folder size={12} />{fd}</button>)}
              {canEdit && <button onClick={() => setModal({ kind: 'folder', value: '' })} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-neutral-500 hover:text-white"><FolderPlus size={12} />New folder</button>}
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {KINDS.map(([k, l, I]) => (
              <button key={k} onClick={() => setKind(k)} className={cx('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs', kind === k ? 'bg-white text-neutral-900' : 'text-neutral-400 hover:text-white')}><I size={12} />{l}</button>
            ))}
            <span className="ml-auto text-xs text-neutral-500">{list.length} item{list.length === 1 ? '' : 's'}{size ? ` · ${fmtSize(size)}` : ''}</span>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-4 md:px-8 py-5"
          onDragOver={e => { if (project && e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
          onDrop={e => { if (!project) return; e.preventDefault(); upload(e.dataTransfer.files); }}>
          {!list.length && <Empty icon={Files} title={all.length ? 'Nothing matches' : 'No files yet'} text={all.length ? 'Try another project, folder or type.' : 'Files and links shared in any project chat appear here. Pick a project and upload to add some.'} />}
          {grid ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {list.map(f => (
                <div key={f.it.id} className="group rounded-2xl bg-[#181818] ring-1 ring-white/[.06] hover:ring-white/15 overflow-hidden transition">
                  <div onClick={() => open(f)} className="cursor-pointer">{thumb(f, 'h-28 w-full')}</div>
                  <div className="p-2.5">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm truncate" title={f.it.title}>{f.it.title}</div>
                        <div className="text-[11px] text-neutral-500 truncate">{f.p.name}{f.it.folder ? ` / ${f.it.folder}` : ''}</div>
                      </div>
                      {actions(f)}
                    </div>
                    <div className="text-[11px] text-neutral-600 mt-1">{f.it.file?.size ? fmtSize(f.it.file.size) + ' · ' : ''}{fmtRel(f.it.createdAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/[.05] rounded-2xl ring-1 ring-white/[.06] overflow-hidden">
              {list.map(f => (
                <div key={f.it.id} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[.02]">
                  <button onClick={() => open(f)} className="shrink-0 w-9 h-9 rounded-lg overflow-hidden">{thumb(f, 'w-9 h-9')}</button>
                  <button onClick={() => open(f)} className="min-w-0 flex-1 text-left">
                    <div className="text-sm truncate">{f.it.title}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{f.p.name}{f.it.folder ? ` / ${f.it.folder}` : ''} · {f.it.category || 'Other'}</div>
                  </button>
                  <span className="hidden sm:block text-xs text-neutral-500 w-20 text-right">{f.it.file?.size ? fmtSize(f.it.file.size) : f.kind === 'link' ? 'link' : ''}</span>
                  <span className="hidden md:block text-xs text-neutral-600 w-24 text-right">{fmtRel(f.it.createdAt)}</span>
                  {actions(f)}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

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
    </div>
  );
}
