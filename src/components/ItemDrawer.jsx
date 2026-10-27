import { useState } from 'react';
import { X, MessageSquareQuote, Pencil, ExternalLink, Download, StickyNote, History, Info, Trash2, ScanText } from '@/lib/icons';
import { useStore } from '../store';
import { useP, Button, Field, Input, Textarea, Select, Drawer, Modal, StatusBadge, TypeBadge, Secret, Badge } from './ui';
import ReadFileModal, { ReadingView } from './ReadFile';
import { readableKind } from '../lib/docread';
import { setStatus, editItem, addNote, deleteItem, secretValues, maskText } from '../lib/model';
import { TYPES, STATUS, SENSITIVE_CATS, isActive } from '../lib/meta';
import { FILE_CATEGORIES } from '../lib/files';
import { hasFile } from '../lib/blobs';
import { useDownload } from './Viewer';
import { cx, fmtDateTime, fmtDue, isOverdue } from '../lib/util';

const FIELD_LABEL = { title: 'Title', detail: 'Details', value: 'Value', category: 'Category', priority: 'Priority', due: 'Due date', assignee: 'Assigned to', scope: 'Scope' };

export default function ItemDrawer({ id, onClose }) {
  const { p, role, mut, jumpTo, openItem, names } = useP();
  const it = p.items.find(i => i.id === id);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [reason, setReason] = useState('');
  const [reading, setReading] = useState(false);
  const { toast } = useStore();
  const dl = useDownload();
  if (!it) return null;

  const T = TYPES[it.type];
  const owner = role === 'owner';
  const who = by => names.of(by);
  const src = p.messages.find(m => m.id === it.sourceMsg);
  const att = it.file && p.messages.flatMap(m => m.attachments).find(a => a.id === it.file.attachmentId);
  const replaced = it.supersededBy && p.items.find(i => i.id === it.supersededBy);
  const replaces = it.replaces && p.items.find(i => i.id === it.replaces);
  const secretField = f => it.type === 'sensitive' && f === 'value';

  const startEdit = () => setEdit({ title: it.title, detail: it.detail, value: it.value, category: it.category, priority: it.priority, due: it.due, assignee: it.assignee, scope: it.scope, note: '' });
  const save = () => {
    const { note: n, ...patch } = edit;
    mut(q => editItem(q, 'owner', it.id, patch, { note: n }));
    setEdit(null);
  };
  const set = k => e => setEdit(x => ({ ...x, [k]: e.target.value }));

  return (
    <Drawer onClose={onClose}>
      <div className="sticky top-0 z-10 bg-card px-5 py-3.5 border-b border-border flex items-center gap-2">
        <TypeBadge type={it.type} /><StatusBadge status={it.status} />
        <div className="flex-1" />
        {owner && !edit && <Button size="sm" variant="ghost" onClick={startEdit}><Pencil size={13} />Edit</Button>}
        {owner && !edit && <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive-foreground" onClick={() => setConfirmDel(true)} title="Delete (created by mistake)"><Trash2 size={15} /></Button>}
        <Button variant="ghost" size="icon" onClick={onClose}><X size={18} /></Button>
      </div>

      <div className="p-5 space-y-6">
        {edit ? (
          <div className="space-y-3 anim-fade">
            <Field label="Title"><Input value={edit.title} onChange={set('title')} /></Field>
            {it.type === 'sensitive' && <Field label="Value" hint="The previous value stays in the history below."><Input value={edit.value} onChange={set('value')} /></Field>}
            {it.type === 'sensitive' && <Field label="Category"><Select value={edit.category} onChange={set('category')}>{Object.entries(SENSITIVE_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>}
            {it.type === 'file' && <Field label="Category"><Select value={edit.category} onChange={set('category')}>{FILE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></Field>}
            {it.type === 'file' && it.kind === 'link' && <Field label="URL"><Input value={edit.value} onChange={set('value')} /></Field>}
            {it.type === 'task' && (
              <div className="grid grid-cols-3 gap-3">
                <Field label="Due"><Input type="date" value={edit.due} onChange={set('due')} /></Field>
                <Field label="Priority"><Select value={edit.priority} onChange={set('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></Select></Field>
                <Field label="Who"><Select value={edit.assignee} onChange={set('assignee')}>{names.assignees(edit.assignee).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></Field>
              </div>
            )}
            {it.type === 'requirement' && <Field label="Scope"><Select value={edit.scope} onChange={set('scope')}><option value="in">In scope</option><option value="out">Out of scope</option></Select></Field>}
            <Field label={it.type === 'sensitive' ? 'Details (username, login link, notes)' : 'Details'}><Textarea value={edit.detail} onChange={set('detail')} placeholder={it.type === 'sensitive' ? 'e.g. Username: admin\nURL: https://example.com/wp-admin' : ''} /></Field>
            <Field label="Why did it change? (optional)"><Input value={edit.note} onChange={set('note')} placeholder="e.g. Client asked on the call" /></Field>
            <div className="flex gap-2 justify-end"><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save change</Button></div>
          </div>
        ) : (
          <div>
            <h2 className={cx('text-xl font-medium leading-snug', !isActive(it) && 'line-through text-muted-foreground')}>{it.title}</h2>
            {it.detail && it.detail !== it.title && <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{it.detail}</p>}
            {it.type === 'sensitive' && it.value && owner && <div className="mt-3 inline-flex rounded-lg bg-neg-soft ring-1 ring-rose-ring px-3 py-2"><Secret value={it.value} /></div>}
            {it.type === 'file' && it.kind === 'link' && <a href={it.value} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline break-all"><ExternalLink size={14} />{it.value}</a>}
            {hasFile(att) && <button onClick={() => dl(att)} className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"><Download size={14} />Download {att.name}</button>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {it.due && <Badge tone={isOverdue(it.due) && isActive(it) ? 'rose' : 'neutral'}>Due {fmtDue(it.due)}</Badge>}
              {it.priority !== 'normal' && <Badge tone={it.priority === 'high' ? 'orange' : 'neutral'}>{it.priority} priority</Badge>}
              {it.assignee && <Badge>{names.of(it.assignee)}</Badge>}
              {it.category && <Badge>{SENSITIVE_CATS[it.category] || it.category}</Badge>}
              {it.type === 'requirement' && <Badge>{it.scope === 'out' ? 'Out of scope' : 'In scope'}</Badge>}
            </div>
            {replaced && <button onClick={() => openItem(replaced.id)} className="mt-3 text-sm text-warn-ink hover:underline block">Replaced by “{replaced.title}” →</button>}
            {replaces && <button onClick={() => openItem(replaces.id)} className="mt-3 text-sm text-muted-foreground hover:underline block">Replaces “{replaces.title}” →</button>}
          </div>
        )}

        {owner && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {T.statuses.map(s => (
                <button key={s} onClick={() => mut(q => setStatus(q, 'owner', it.id, s))}
                  className={cx('px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset transition', it.status === s ? 'bg-card text-text-figure shadow-button ring-border' : 'ring-border text-foreground hover:bg-field-hover')}>{STATUS[s].label}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5"><Info size={12} />Close a record by changing its status — the full trail stays below. Delete it only if it was created by mistake.</p>
          </div>
        )}

        {src && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Where it came from</div>
            <button onClick={() => jumpTo(src.id, it.sourceSpan)} className="w-full text-left rounded-xl bg-field ring-1 ring-border p-3 hover:bg-field-hover transition">
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5"><MessageSquareQuote size={12} />{names.msg(src)} · {fmtDateTime(src.ts)}{it.sourceSpan && <span className="ml-auto text-warn-ink">exact words ↗</span>}</div>
              {it.sourceSpan && src.text
                ? <div className="text-sm text-foreground line-clamp-4"><mark className="hl-mark">{maskText(src.text.slice(it.sourceSpan.start, it.sourceSpan.end), secretValues(p))}</mark></div>
                : <div className="text-sm text-foreground line-clamp-4">{maskText(src.text, secretValues(p)) || src.attachments.map(a => a.name).join(', ')}</div>}
              {it.sourceQuote && <div className="text-sm text-foreground mt-1.5 border-l-2 border-amber-ring pl-2">From the file: “{it.sourceQuote}”</div>}
            </button>
          </div>
        )}

        {it.type === 'file' && att && (it.reading || (owner && hasFile(att) && readableKind(att))) && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><ScanText size={12} />What's inside{it.reading && <span className="text-text-tertiary">· read {fmtDateTime(it.reading.ts)}</span>}</div>
            {it.reading ? (owner ? <ReadingView r={it.reading} /> : it.reading.description && <p className="text-sm text-foreground">{it.reading.description}</p>) : <p className="text-sm text-muted-foreground">Not read yet. The AI can read its text, tables and pictures and propose records.</p>}
            {owner && src && hasFile(att) && readableKind(att) && <Button size="sm" className="mt-3" onClick={() => setReading(true)}><ScanText size={13} />{it.reading ? 'Read again' : 'Read with AI'}</Button>}
          </div>
        )}

        {it.type === 'requirement' && it.versions.length > 1 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Versions</div>
            <ol className="space-y-2">
              {[...it.versions].reverse().map((v, i) => (
                <li key={i} className="rounded-xl bg-field p-3">
                  <div className="text-xs text-muted-foreground flex gap-2">v{it.versions.length - i} · {fmtDateTime(v.ts)} · {who(v.by)}{v.msg && <button onClick={() => jumpTo(v.msg)} className="text-primary hover:underline">source</button>}</div>
                  <div className={cx('text-sm mt-1', i > 0 && 'text-muted-foreground')}>{v.title}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><StickyNote size={12} />Notes</div>
          {it.notes.map(n => (
            <div key={n.id} className="rounded-xl bg-field p-3 mb-2 text-sm">
              <div className="text-xs text-muted-foreground mb-1">{who(n.by)} · {fmtDateTime(n.ts)}{n.msg && <button onClick={() => jumpTo(n.msg)} className="ml-2 text-primary hover:underline">source</button>}</div>{n.text}
            </div>
          ))}
          {owner && (
            <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return; mut(q => addNote(q, 'owner', it.id, note)); setNote(''); }} className="flex gap-2">
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" />
              <Button type="submit" disabled={!note.trim()}>Add</Button>
            </form>
          )}
          {!owner && !it.notes.length && <div className="text-sm text-text-tertiary">No notes.</div>}
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><History size={12} />History</div>
          <ol className="border-l border-border ml-1.5 space-y-3">
            {[...it.history].reverse().map((h, i) => (
              <li key={i} className="pl-4 relative text-sm">
                <span className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-grey-400" />
                <div className="text-foreground">
                  {h.action === 'created' && <>Recorded by {who(h.by)}</>}
                  {h.action === 'status' && <>{who(h.by)} changed status: <b className="font-medium">{STATUS[h.from]?.label}</b> → <b className="font-medium">{STATUS[h.to]?.label}</b></>}
                  {h.action === 'edit' && <>{who(h.by)} changed {FIELD_LABEL[h.field] || h.field}{!secretField(h.field) && h.field !== 'detail' && <>: <span className="text-muted-foreground line-through">{String(h.from || '—')}</span> → {String(h.to || '—')}</>}{secretField(h.field) && owner && <> (previous: <Secret value={String(h.from || '')} copy={false} />)</>}</>}
                  {h.action === 'note' && <>{who(h.by)} added a note</>}
                  {h.action === 'read' && <>{who(h.by)} had the file read{h.note ? ` — ${h.note}` : ''}</>}
                  {h.action === 'deleted' && <>{who(h.by)} deleted it</>}
                </div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(h.ts)}{h.note && h.action !== 'note' ? ` · ${h.note}` : ''}{h.msg && h.action !== 'created' && <button onClick={() => jumpTo(h.msg)} className="ml-2 text-primary hover:underline">message</button>}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {reading && src && att && <ReadFileModal message={src} attachment={att} onClose={() => setReading(false)} />}
      {confirmDel && (
        <Modal title={`Delete this ${T.label.toLowerCase()}?`} sub="Only for records created by mistake. To close a real one, change its status instead (e.g. cancelled, dropped)." onClose={() => setConfirmDel(false)}
          footer={<><Button variant="ghost" onClick={() => setConfirmDel(false)}>Keep it</Button><Button variant="danger" onClick={() => { mut(q => deleteItem(q, 'owner', it.id, reason.trim())); toast(`Deleted “${it.title}”`); onClose(); }}><Trash2 size={14} />Delete</Button></>}>
          <div className="space-y-3">
            <div className="rounded-xl bg-field p-3 text-sm">{it.title}</div>
            <p className="text-sm text-muted-foreground">It disappears from every list, the chat links, search and the AI's view, in every open tab. The project log keeps a line saying it was deleted.</p>
            <Field label="Why? (optional)"><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Duplicate, created by mistake" /></Field>
          </div>
        </Modal>
      )}
    </Drawer>
  );
}
