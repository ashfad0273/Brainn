import { useState } from 'react';
import { X, MessageSquareQuote, Pencil, ExternalLink, Download, StickyNote, History, Info } from 'lucide-react';
import { useP, Button, Field, Input, Textarea, Select, Drawer, StatusBadge, TypeBadge, Secret, Badge } from './ui';
import { setStatus, editItem, addNote, secretValues, maskText } from '../lib/model';
import { TYPES, STATUS, SENSITIVE_CATS, isActive } from '../lib/meta';
import { FILE_CATEGORIES } from '../lib/files';
import { cx, fmtDateTime, fmtDue, isOverdue } from '../lib/util';

const FIELD_LABEL = { title: 'Title', detail: 'Details', value: 'Value', category: 'Category', priority: 'Priority', due: 'Due date', assignee: 'Assigned to', scope: 'Scope' };

export default function ItemDrawer({ id, onClose }) {
  const { p, role, mut, jumpTo, openItem, names } = useP();
  const it = p.items.find(i => i.id === id);
  const [edit, setEdit] = useState(null);
  const [note, setNote] = useState('');
  if (!it) return null;

  const T = TYPES[it.type];
  const owner = role === 'owner';
  const who = by => (by === 'owner' ? names.owner : by === 'client' ? names.client : 'Project brain');
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
      <div className="sticky top-0 z-10 bg-[#171717]/95 backdrop-blur px-5 py-3.5 border-b border-white/5 flex items-center gap-2">
        <TypeBadge type={it.type} /><StatusBadge status={it.status} />
        <div className="flex-1" />
        {owner && !edit && <Button size="sm" variant="ghost" onClick={startEdit}><Pencil size={13} />Edit</Button>}
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
                <Field label="Who"><Select value={edit.assignee} onChange={set('assignee')}><option value="owner">{names.owner}</option><option value="client">{names.client}</option></Select></Field>
              </div>
            )}
            {it.type === 'requirement' && <Field label="Scope"><Select value={edit.scope} onChange={set('scope')}><option value="in">In scope</option><option value="out">Out of scope</option></Select></Field>}
            {it.type !== 'sensitive' && <Field label="Details"><Textarea value={edit.detail} onChange={set('detail')} /></Field>}
            <Field label="Why did it change? (optional)"><Input value={edit.note} onChange={set('note')} placeholder="e.g. Client asked on the call" /></Field>
            <div className="flex gap-2 justify-end"><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary" onClick={save}>Save change</Button></div>
          </div>
        ) : (
          <div>
            <h2 className={cx('text-xl font-semibold leading-snug', !isActive(it) && 'line-through text-neutral-400')}>{it.title}</h2>
            {it.detail && it.detail !== it.title && <p className="text-sm text-neutral-400 mt-2 whitespace-pre-wrap">{it.detail}</p>}
            {it.type === 'sensitive' && it.value && owner && <div className="mt-3 inline-flex rounded-lg bg-black/30 ring-1 ring-rose-500/25 px-3 py-2"><Secret value={it.value} /></div>}
            {it.type === 'file' && it.kind === 'link' && <a href={it.value} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-300 hover:underline break-all"><ExternalLink size={14} />{it.value}</a>}
            {att?.dataUrl && <a href={att.dataUrl} download={att.name} className="mt-3 inline-flex items-center gap-1.5 text-sm text-sky-300 hover:underline"><Download size={14} />Download {att.name}</a>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {it.due && <Badge tone={isOverdue(it.due) && isActive(it) ? 'rose' : 'neutral'}>Due {fmtDue(it.due)}</Badge>}
              {it.priority !== 'normal' && <Badge tone={it.priority === 'high' ? 'orange' : 'neutral'}>{it.priority} priority</Badge>}
              {it.assignee && <Badge>{it.assignee === 'owner' ? names.owner : names.client}</Badge>}
              {it.category && <Badge>{SENSITIVE_CATS[it.category] || it.category}</Badge>}
              {it.type === 'requirement' && <Badge>{it.scope === 'out' ? 'Out of scope' : 'In scope'}</Badge>}
            </div>
            {replaced && <button onClick={() => openItem(replaced.id)} className="mt-3 text-sm text-amber-300 hover:underline block">Replaced by “{replaced.title}” →</button>}
            {replaces && <button onClick={() => openItem(replaces.id)} className="mt-3 text-sm text-neutral-400 hover:underline block">Replaces “{replaces.title}” →</button>}
          </div>
        )}

        {owner && (
          <div>
            <div className="text-xs font-medium text-neutral-400 mb-2">Status</div>
            <div className="flex flex-wrap gap-1.5">
              {T.statuses.map(s => (
                <button key={s} onClick={() => mut(q => setStatus(q, 'owner', it.id, s))}
                  className={cx('px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset transition', it.status === s ? 'bg-white text-neutral-900 ring-white' : 'ring-white/10 text-neutral-300 hover:bg-white/5')}>{STATUS[s].label}</button>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1.5"><Info size={12} />Records are never deleted. Close one by changing its status — the full trail stays below.</p>
          </div>
        )}

        {src && (
          <div>
            <div className="text-xs font-medium text-neutral-400 mb-2">Where it came from</div>
            <button onClick={() => jumpTo(src.id)} className="w-full text-left rounded-xl bg-white/[.03] ring-1 ring-white/[.06] p-3 hover:bg-white/[.06] transition">
              <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1.5"><MessageSquareQuote size={12} />{who(src.from)} · {fmtDateTime(src.ts)}</div>
              <div className="text-sm text-neutral-300 line-clamp-4">{maskText(src.text, secretValues(p)) || src.attachments.map(a => a.name).join(', ')}</div>
            </button>
          </div>
        )}

        {it.type === 'requirement' && it.versions.length > 1 && (
          <div>
            <div className="text-xs font-medium text-neutral-400 mb-2">Versions</div>
            <ol className="space-y-2">
              {[...it.versions].reverse().map((v, i) => (
                <li key={i} className="rounded-xl bg-white/[.03] p-3">
                  <div className="text-xs text-neutral-500 flex gap-2">v{it.versions.length - i} · {fmtDateTime(v.ts)} · {who(v.by)}{v.msg && <button onClick={() => jumpTo(v.msg)} className="text-sky-400 hover:underline">source</button>}</div>
                  <div className={cx('text-sm mt-1', i > 0 && 'text-neutral-500')}>{v.title}</div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div>
          <div className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5"><StickyNote size={12} />Notes</div>
          {it.notes.map(n => (
            <div key={n.id} className="rounded-xl bg-white/[.03] p-3 mb-2 text-sm">
              <div className="text-xs text-neutral-500 mb-1">{who(n.by)} · {fmtDateTime(n.ts)}{n.msg && <button onClick={() => jumpTo(n.msg)} className="ml-2 text-sky-400 hover:underline">source</button>}</div>{n.text}
            </div>
          ))}
          {owner && (
            <form onSubmit={e => { e.preventDefault(); if (!note.trim()) return; mut(q => addNote(q, 'owner', it.id, note)); setNote(''); }} className="flex gap-2">
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note…" />
              <Button type="submit" disabled={!note.trim()}>Add</Button>
            </form>
          )}
          {!owner && !it.notes.length && <div className="text-sm text-neutral-600">No notes.</div>}
        </div>

        <div>
          <div className="text-xs font-medium text-neutral-400 mb-2 flex items-center gap-1.5"><History size={12} />History</div>
          <ol className="border-l border-white/10 ml-1.5 space-y-3">
            {[...it.history].reverse().map((h, i) => (
              <li key={i} className="pl-4 relative text-sm">
                <span className="absolute -left-[4.5px] top-1.5 w-2 h-2 rounded-full bg-neutral-500" />
                <div className="text-neutral-300">
                  {h.action === 'created' && <>Recorded by {who(h.by)}</>}
                  {h.action === 'status' && <>{who(h.by)} changed status: <b className="font-medium">{STATUS[h.from]?.label}</b> → <b className="font-medium">{STATUS[h.to]?.label}</b></>}
                  {h.action === 'edit' && <>{who(h.by)} changed {FIELD_LABEL[h.field] || h.field}{!secretField(h.field) && h.field !== 'detail' && <>: <span className="text-neutral-500 line-through">{String(h.from || '—')}</span> → {String(h.to || '—')}</>}{secretField(h.field) && owner && <> (previous: <Secret value={String(h.from || '')} copy={false} />)</>}</>}
                  {h.action === 'note' && <>{who(h.by)} added a note</>}
                </div>
                <div className="text-xs text-neutral-500">{fmtDateTime(h.ts)}{h.note && h.action !== 'note' ? ` · ${h.note}` : ''}{h.msg && h.action !== 'created' && <button onClick={() => jumpTo(h.msg)} className="ml-2 text-sky-400 hover:underline">message</button>}</div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Drawer>
  );
}
