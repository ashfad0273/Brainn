import LinkPreview from './LinkPreview';
import { useMemo, useState } from 'react';
import { Check, Plus, MessageSquareQuote, Calendar, Flag, Download, ExternalLink, ShieldCheck, Lock, Paperclip, ListTodo, ListChecks, GitBranch, Layers, Mic } from '@/lib/icons';
import { useStore } from '../store';
import { useP, Button, Modal, Field, Input, Textarea, Select, Badge, StatusBadge, TypeIcon, Empty, Section, Secret } from './ui';
import { addItem, setStatus } from '../lib/model';
import { TYPES, TYPE_ORDER, SENSITIVE_CATS, isActive } from '../lib/meta';
import { FILE_CATEGORIES, categorizeLink, linkTitle } from '../lib/files';
import { hasFile } from '../lib/blobs';
import { ImageThumb, useDownload } from './Viewer';
import { cx, fmtDue, isOverdue, fmtDateTime, fmtSize } from '../lib/util';

const closedAt = it => [...it.history].reverse().find(h => h.action === 'status')?.ts || it.updatedAt;

/* ---------- small pieces ---------- */

export function TaskCheck({ it }) {
  const { role, mut } = useP();
  const done = it.status === 'done', dead = it.status === 'cancelled';
  const owner = role === 'owner';
  return (
    <button type="button" disabled={!owner || dead} title={owner ? (done ? 'Reopen' : 'Mark done') : STATUS_TITLE[it.status]}
      onClick={e => { e.stopPropagation(); mut(q => setStatus(q, 'owner', it.id, done ? 'open' : 'done')); }}
      className={cx('mt-0.5 w-[18px] h-[18px] rounded-md ring-1 ring-inset grid place-items-center shrink-0 transition',
        done ? 'bg-green ring-green-ring text-primary-foreground' : dead ? 'ring-border bg-field' : 'ring-border-strong hover:ring-green text-transparent hover:text-pos')}>
      <Check size={12} strokeWidth={3} />
    </button>
  );
}
const STATUS_TITLE = { done: 'Done', open: 'Open', in_progress: 'In progress', blocked: 'Blocked', cancelled: 'Cancelled' };

export function ItemRow({ it, showType }) {
  const { role, openItem, jumpTo, names } = useP();
  const closed = !isActive(it);
  const T = TYPES[it.type];
  return (
    <div onClick={() => openItem(it.id)} id={'item-' + it.id} className="group flex items-start gap-3 px-2.5 py-2 rounded-xl hover:bg-field-hover cursor-pointer transition">
      {it.type === 'task' ? <TaskCheck it={it} /> : <TypeIcon type={it.type} size="sm" />}
      <div className="flex-1 min-w-0">
        <div className={cx('text-sm leading-snug', closed ? 'text-muted-foreground line-through decoration-border-strong' : 'text-foreground')}>{it.title}</div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1 empty:hidden">
          {showType && <Badge tone={T.color}>{T.label}</Badge>}
          {it.status !== T.initial && <StatusBadge status={it.status} />}
          {it.due && <Badge tone={isOverdue(it.due) && !closed ? 'rose' : 'neutral'}><Calendar size={10} />{fmtDue(it.due)}</Badge>}
          {it.priority === 'high' && <Badge tone="orange"><Flag size={10} />High</Badge>}
          {it.type === 'task' && it.assignee && it.assignee !== 'owner' && <Badge tone="amber">Waiting on {names.of(it.assignee).split(' ')[0]}</Badge>}
          {it.type === 'requirement' && it.versions.length > 1 && <Badge tone="sky" title="Changed during the conversation">v{it.versions.length}</Badge>}
          {it.type === 'requirement' && it.scope === 'out' && <Badge>Out of scope</Badge>}
          {it.notes.length > 0 && <Badge>{it.notes.length} note{it.notes.length > 1 ? 's' : ''}</Badge>}
          {it.type === 'sensitive' && role === 'owner' && it.value && <Secret value={it.value} className="text-muted-foreground" />}
        </div>
      </div>
      {it.sourceMsg && (
        <button type="button" title="Jump to the message where this came from" onClick={e => { e.stopPropagation(); jumpTo(it.sourceMsg, it.sourceSpan); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-field-hover transition"><MessageSquareQuote size={15} /></button>
      )}
    </div>
  );
}

/* ---------- create form ---------- */

export function ItemFormModal({ type: initialType = 'task', sourceMsg = null, initial = {}, onClose }) {
  const { p, mut, names } = useP();
  const { toast } = useStore();
  const [d, setD] = useState({ type: initialType, title: '', detail: '', value: '', category: initialType === 'sensitive' ? 'credential' : '', priority: 'normal', due: '', assignee: 'owner', scope: 'in', ...initial });
  const set = k => e => setD(x => ({ ...x, [k]: e.target.value }));
  const src = sourceMsg && p.messages.find(m => m.id === sourceMsg);
  const isLink = d.type === 'file';
  const save = () => {
    if (isLink && !/^(https?:\/\/|www\.)/i.test(d.value.trim())) return toast('Enter a link starting with http(s)://', 'error');
    if (!isLink && !d.title.trim()) return toast('Give it a title', 'error');
    mut(q => addItem(q, 'owner', {
      ...d, title: isLink ? d.title.trim() || linkTitle(d.value.trim()) : d.title, value: d.value.trim(),
      category: isLink ? d.category || categorizeLink(d.value) : d.category, kind: isLink ? 'link' : '', sourceMsg, via: 'manual',
    }));
    toast(`${TYPES[d.type].label} recorded`);
    onClose();
  };
  return (
    <Modal title={`New ${TYPES[d.type].label.toLowerCase()}`} sub={src ? 'Linked to the selected message' : 'Recorded permanently in this project'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>Save</Button></>}>
      <div className="space-y-3">
        {src && <blockquote className="text-sm text-muted-foreground border-l-2 border-border pl-3 italic line-clamp-3">{src.text || src.attachments[0]?.name}</blockquote>}
        <Field label="Type">
          <div className="flex flex-wrap gap-1.5">
            {TYPE_ORDER.map(t => (
              <button key={t} type="button" onClick={() => setD(x => ({ ...x, type: t, category: t === 'sensitive' ? 'credential' : '' }))}
                className={cx('px-2.5 py-1 rounded-lg text-xs ring-1 ring-inset transition', d.type === t ? 'bg-card text-text-figure shadow-button ring-border' : 'ring-border text-foreground hover:bg-field-hover')}>{t === 'file' ? 'Link' : TYPES[t].label}</button>
            ))}
          </div>
        </Field>
        {isLink && <Field label="URL"><Input autoFocus value={d.value} onChange={set('value')} placeholder="https://…" /></Field>}
        <Field label={isLink ? 'Title (optional)' : 'Title'}><Input autoFocus={!isLink} value={d.title} onChange={set('title')} placeholder={d.type === 'sensitive' ? 'e.g. Staging password' : 'Short and clear'} /></Field>
        {d.type === 'sensitive' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Value"><Input type="password" value={d.value} onChange={set('value')} placeholder="Secret value" autoComplete="new-password" /></Field>
            <Field label="Category"><Select value={d.category} onChange={set('category')}>{Object.entries(SENSITIVE_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
          </div>
        )}
        {d.type === 'task' && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Due"><Input type="date" value={d.due} onChange={set('due')} /></Field>
            <Field label="Priority"><Select value={d.priority} onChange={set('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></Select></Field>
            <Field label="Who"><Select value={d.assignee} onChange={set('assignee')}>{names.assignees(d.assignee).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></Field>
          </div>
        )}
        {d.type === 'requirement' && <Field label="Scope"><Select value={d.scope} onChange={set('scope')}><option value="in">In scope</option><option value="out">Out of scope</option></Select></Field>}
        {isLink && <Field label="Category"><Select value={d.category || categorizeLink(d.value)} onChange={set('category')}>{FILE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</Select></Field>}
        {d.type !== 'sensitive' && <Field label="Details (optional)"><Textarea value={d.detail} onChange={set('detail')} /></Field>}
      </div>
    </Modal>
  );
}

function Toolbar({ filters, value, onChange, children }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex bg-card ring-1 ring-border rounded-xl p-0.5">
        {filters.map(([k, label, n]) => (
          <button key={k} onClick={() => onChange(k)} className={cx('px-3 py-1.5 rounded-lg text-sm transition', value === k ? 'bg-field-hover text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {label}{n != null && <span className="ml-1.5 text-xs text-muted-foreground">{n}</span>}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      {children}
    </div>
  );
}

const Page = ({ children }) => <div className="flex-1 overflow-auto"><div className="max-w-4xl mx-auto px-4 md:px-8 py-6">{children}</div></div>;

/* ---------- tasks ---------- */

export function TasksView() {
  const { p, role } = useP();
  const [f, setF] = useState('active');
  const [adding, setAdding] = useState(false);
  const tasks = p.items.filter(i => i.type === 'task');
  const active = tasks.filter(isActive).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (b.priority === 'high') - (a.priority === 'high') || a.createdAt - b.createdAt);
  const done = tasks.filter(t => t.status === 'done').sort((a, b) => closedAt(b) - closedAt(a));
  const cancelled = tasks.filter(t => t.status === 'cancelled');
  const groups = f === 'active'
    ? [['In progress', active.filter(t => t.status === 'in_progress')], ['Blocked', active.filter(t => t.status === 'blocked')], ['Open', active.filter(t => t.status === 'open')]]
    : f === 'done' ? [['Completed', done]] : f === 'cancelled' ? [['Cancelled', cancelled]] : [['All tasks', [...tasks].sort((a, b) => a.createdAt - b.createdAt)]];
  return (
    <Page>
      <Progress done={done.length} total={tasks.length - cancelled.length} />
      <Toolbar value={f} onChange={setF} filters={[['active', 'Open', active.length], ['done', 'Done', done.length], ['cancelled', 'Cancelled', cancelled.length], ['all', 'All', tasks.length]]}>
        {role === 'owner' && <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus size={14} />Task</Button>}
      </Toolbar>
      {tasks.length === 0 ? <Empty icon={ListTodo} title="No tasks yet" text="Tasks appear when someone asks for something in the chat — or add one yourself." /> : (
        <div className="space-y-3">
          {groups.filter(([, l]) => l.length).map(([title, l]) => <Section key={title} title={title} count={l.length}>{l.map(t => <ItemRow key={t.id} it={t} />)}</Section>)}
          {groups.every(([, l]) => !l.length) && <Empty title="Nothing here" text="No tasks match this filter." />}
        </div>
      )}
      {adding && <ItemFormModal type="task" onClose={() => setAdding(false)} />}
    </Page>
  );
}

function Progress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="mb-5 rounded-2xl bg-card ring-1 ring-border p-4">
      <div className="flex items-baseline justify-between"><span className="text-sm text-muted-foreground">Progress</span><span className="text-sm"><b className="text-foreground text-lg">{done}</b><span className="text-muted-foreground"> of {total} tasks done</span></span></div>
      <div className="h-2 bg-field rounded-full overflow-hidden mt-2"><div className="h-full bg-green rounded-full transition-all duration-700" style={{ width: pct + '%' }} /></div>
    </div>
  );
}

/* ---------- requirements ---------- */

export function RequirementsView() {
  const { p, role } = useP();
  const [f, setF] = useState('current');
  const [adding, setAdding] = useState(false);
  const reqs = p.items.filter(i => i.type === 'requirement');
  const inScope = reqs.filter(r => r.status === 'active' && r.scope === 'in');
  const outScope = reqs.filter(r => r.status === 'active' && r.scope === 'out');
  const delivered = reqs.filter(r => r.status === 'delivered'), dropped = reqs.filter(r => r.status === 'dropped');
  const changed = reqs.filter(r => r.versions.length > 1).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <Page>
      <Toolbar value={f} onChange={setF} filters={[['current', 'Current', inScope.length + outScope.length], ['changed', 'Changed', changed.length], ['closed', 'Delivered & dropped', delivered.length + dropped.length]]}>
        {role === 'owner' && <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus size={14} />Requirement</Button>}
      </Toolbar>
      {!reqs.length && <Empty icon={ListChecks} title="No requirements yet" text="When the client says what they want — a look, a feature, a constraint — it shows up here, with every version kept." />}
      <div className="space-y-3">
        {f === 'current' && <>
          {inScope.length > 0 && <Section title="In scope" count={inScope.length}>{inScope.map(r => <ItemRow key={r.id} it={r} />)}</Section>}
          {outScope.length > 0 && <Section title="Out of scope" count={outScope.length}>{outScope.map(r => <ItemRow key={r.id} it={r} />)}</Section>}
        </>}
        {f === 'changed' && (changed.length ? changed.map(r => <VersionCard key={r.id} r={r} />) : <Empty title="No changes yet" text="When a requirement changes in the conversation, its full version history appears here." />)}
        {f === 'closed' && <>
          {delivered.length > 0 && <Section title="Delivered" count={delivered.length}>{delivered.map(r => <ItemRow key={r.id} it={r} />)}</Section>}
          {dropped.length > 0 && <Section title="Dropped" count={dropped.length}>{dropped.map(r => <ItemRow key={r.id} it={r} />)}</Section>}
          {!delivered.length && !dropped.length && <Empty title="Nothing closed yet" />}
        </>}
      </div>
      {adding && <ItemFormModal type="requirement" onClose={() => setAdding(false)} />}
    </Page>
  );
}

function VersionCard({ r }) {
  const { openItem, jumpTo } = useP();
  return (
    <div className="rounded-2xl bg-card ring-1 ring-border p-4">
      <button onClick={() => openItem(r.id)} className="text-left font-medium hover:underline">{r.title}</button>
      <ol className="mt-3 space-y-2 border-l border-border ml-1.5">
        {[...r.versions].reverse().map((v, i) => (
          <li key={v.ts + '' + i} className="pl-4 relative">
            <span className={cx('absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full', i === 0 ? 'bg-primary' : 'bg-grey-400')} />
            <div className={cx('text-sm', i === 0 ? 'text-foreground' : 'text-muted-foreground line-through decoration-border-strong')}>{v.title}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">v{r.versions.length - i} · {fmtDateTime(v.ts)}
              {v.msg && <button onClick={() => jumpTo(v.msg)} className="text-primary hover:underline">source</button>}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------- decisions ---------- */

export function DecisionsView() {
  const { p, role, openItem, jumpTo } = useP();
  const [adding, setAdding] = useState(false);
  const decs = p.items.filter(i => i.type === 'decision').sort((a, b) => b.createdAt - a.createdAt);
  return (
    <Page>
      <div className="flex items-center mb-4"><p className="text-sm text-muted-foreground flex-1">What was agreed, when, and the exact words — newest first.</p>
        {role === 'owner' && <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus size={14} />Decision</Button>}</div>
      {!decs.length && <Empty icon={GitBranch} title="No decisions yet" text="“Let’s go with option B”, “approved”, “lgtm” — agreements land here with the original wording." />}
      <ol className="relative border-l border-border ml-3 space-y-4">
        {decs.map(d => {
          const src = p.messages.find(m => m.id === d.sourceMsg);
          return (
            <li key={d.id} className="pl-6 relative anim-up">
              <span className={cx('absolute -left-[7px] top-4 w-3.5 h-3.5 rounded-full ring-4 ring-background', isActive(d) ? 'bg-violet' : 'bg-grey-400')} />
              <div onClick={() => openItem(d.id)} className="rounded-2xl bg-card ring-1 ring-border p-4 hover:ring-border-strong cursor-pointer transition">
                <div className="flex items-start gap-2">
                  <div className={cx('flex-1 font-medium', !isActive(d) && 'line-through text-muted-foreground')}>{d.title}</div>
                  {!isActive(d) && <StatusBadge status={d.status} />}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{fmtDateTime(d.createdAt)}</div>
                {src?.text && (
                  <button onClick={e => { e.stopPropagation(); jumpTo(src.id, d.sourceSpan); }} className="mt-3 block text-left text-sm text-muted-foreground border-l-2 border-violet-ring pl-3 italic hover:text-foreground line-clamp-4">“{d.sourceSpan ? src.text.slice(d.sourceSpan.start, d.sourceSpan.end) : src.text}”</button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {adding && <ItemFormModal type="decision" onClose={() => setAdding(false)} />}
    </Page>
  );
}

/* ---------- vault ---------- */

export function VaultView() {
  const { p } = useP();
  const { encrypted } = useStore();
  const [f, setF] = useState('active');
  const [adding, setAdding] = useState(false);
  const all = p.items.filter(i => i.type === 'sensitive');
  const list = f === 'active' ? all.filter(isActive) : all.filter(i => !isActive(i));
  const byCat = Object.keys(SENSITIVE_CATS).map(c => [c, list.filter(i => (i.category || 'confidential') === c)]).filter(([, l]) => l.length);
  return (
    <Page>
      <div className={cx('mb-4 rounded-2xl p-4 flex items-start gap-3 ring-1', encrypted ? 'bg-pos-soft ring-green-ring' : 'bg-warn-soft ring-amber-ring')}>
        {encrypted ? <ShieldCheck className="text-pos shrink-0" size={20} /> : <Lock className="text-warn-ink shrink-0" size={20} />}
        <div className="text-sm">
          <div className={encrypted ? 'text-pos' : 'text-warn-ink'}>{encrypted ? 'Workspace encrypted with your passphrase' : 'Stored in this browser only — not encrypted yet'}</div>
          <div className="text-muted-foreground mt-0.5">Values are masked everywhere, including in the chat. Reveal one for 10 seconds or copy it. Old values are kept as “replaced”, never deleted. {!encrypted && 'Turn on encryption in Settings → Security.'}</div>
        </div>
      </div>
      <Toolbar value={f} onChange={setF} filters={[['active', 'Current', all.filter(isActive).length], ['history', 'Replaced & revoked', all.filter(i => !isActive(i)).length]]}>
        <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus size={14} />Add</Button>
      </Toolbar>
      {!list.length && <Empty icon={Lock} title={f === 'active' ? 'Nothing sensitive recorded' : 'No history yet'} text="Passwords, logins, emails, phone numbers, budgets and other private details are detected in the chat and kept here." />}
      <div className="space-y-3">{byCat.map(([c, l]) => <Section key={c} title={SENSITIVE_CATS[c]} count={l.length}>{l.map(i => <ItemRow key={i.id} it={i} />)}</Section>)}</div>
      {adding && <ItemFormModal type="sensitive" onClose={() => setAdding(false)} />}
    </Page>
  );
}

/* ---------- files ---------- */

export function FilesView() {
  const { p, role, openItem, jumpTo } = useP();
  const [cat, setCat] = useState('All');
  const [adding, setAdding] = useState(false);
  const dl = useDownload();
  const files =p.items.filter(i => i.type === 'file').sort((a, b) => b.createdAt - a.createdAt);
  const att = useMemo(() => Object.fromEntries(p.messages.flatMap(m => m.attachments.map(a => [a.id, a]))), [p.messages]);
  const cats = ['All', ...new Set(files.map(f => f.category || 'Other'))];
  const list = cat === 'All' ? files : files.filter(f => (f.category || 'Other') === cat);
  return (
    <Page>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {cats.map(c => (
          <button key={c} onClick={() => setCat(c)} className={cx('px-3 py-1.5 rounded-lg text-sm ring-1 ring-inset transition', cat === c ? 'bg-card text-text-figure shadow-button ring-border' : 'ring-border text-muted-foreground hover:text-foreground')}>
            {c}<span className="ml-1.5 text-xs opacity-60">{c === 'All' ? files.length : files.filter(f => (f.category || 'Other') === c).length}</span>
          </button>
        ))}
        <div className="flex-1" />
        {role === 'owner' && <Button variant="primary" size="sm" onClick={() => setAdding(true)}><Plus size={14} />Link</Button>}
      </div>
      {!files.length && <Empty icon={Paperclip} title="No files yet" text="Files, images and voice notes sent in the chat are sorted here automatically, with links back to the conversation." />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(f => {
          const a = f.file && att[f.file.attachmentId];
          const isLink = f.kind === 'link';
          return (
            <div key={f.id} className={cx('rounded-2xl bg-card ring-1 ring-border overflow-hidden hover:ring-border-strong transition group', !isActive(f) && 'opacity-60')}>
              {isLink && /^https?:/.test(f.value || '') ? <LinkPreview href={f.value} className="mt-0 max-w-none rounded-none ring-0 bg-transparent" /> : (
              <div onClick={() => openItem(f.id)} className="h-28 bg-teal-soft text-teal grid place-items-center cursor-pointer overflow-hidden">
                {a?.kind === 'image' && hasFile(a) ? <ImageThumb a={a} className="w-full h-full cursor-zoom-in" imgClass="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  : isLink ? <ExternalLink className="text-teal" size={28} /> : f.kind === 'voice' ? <Mic className="text-teal" size={28} /> : <Layers className="text-teal" size={28} />}
              </div>)}
              <div className="p-3">
                <div className="text-sm font-medium truncate" title={f.title}>{f.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">{f.category || 'Other'}{f.file?.size ? ' · ' + fmtSize(f.file.size) : ''}{!isActive(f) && <StatusBadge status={f.status} />}</div>
                <div className="flex items-center gap-1 mt-2 -ml-1">
                  {isLink && <a href={f.value} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-md hover:bg-field-hover text-primary flex items-center gap-1"><ExternalLink size={12} />Open</a>}
                  {hasFile(a) && <button onClick={() => dl(a)} className="text-xs px-2 py-1 rounded-md hover:bg-field-hover text-foreground flex items-center gap-1"><Download size={12} />Download</button>}
                  {f.sourceMsg && <button onClick={() => jumpTo(f.sourceMsg, f.sourceSpan)} className="text-xs px-2 py-1 rounded-md hover:bg-field-hover text-muted-foreground flex items-center gap-1"><MessageSquareQuote size={12} />In chat</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {adding && <ItemFormModal type="file" onClose={() => setAdding(false)} />}
    </Page>
  );
}
