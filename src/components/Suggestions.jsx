import { useState } from 'react';
import { Modal } from './ui';
import { Sparkles, MessageSquareQuote, RefreshCw, ChevronDown, Undo2, CheckCheck, Calendar, XCircle, FileText } from 'lucide-react';
import { useStore } from '../store';
import { useP, Button, Badge, Input, Select, Spinner, Secret } from './ui';
import { resolveSuggestion, secretValues, maskText } from '../lib/model';
import { analyze, aiOn, aiName } from '../lib/brain';
import { engineName } from '../lib/gemini';
import { TYPES, STATUS, COLOR, isActive } from '../lib/meta';
import { cx, fmtDue, fmtRel, isOverdue } from '../lib/util';

const opLabel = s => {
  const t = TYPES[s.type].label.toLowerCase();
  if (s.op === 'create') return s.type === 'file' ? 'New link' : s.replaces ? `New ${t} (replaces old)` : `New ${t}`;
  if (s.op === 'update') return `Update ${t}`;
  if (s.op === 'status') return `Mark ${STATUS[s.status]?.label.toLowerCase()}`;
  return `Note on ${t}`;
};

/** The words a suggestion came from: a passage of the chat message, or a quote from a file. */
function SourcePassage({ s, p }) {
  const m = s.msg && p.messages.find(x => x.id === s.msg);
  const file = s.attachmentId && m?.attachments.find(a => a.id === s.attachmentId);
  const text = s.span && m?.text ? m.text.slice(s.span.start, s.span.end) : s.quote;
  if (!text || s.reason?.includes(text.trim())) return null; // the rules' reason often quotes the clause already
  return (
    <div className="mt-1.5 text-xs text-neutral-400 border-l-2 border-amber-400/40 pl-2 line-clamp-3">
      {file && <span className="text-neutral-500 mr-1 inline-flex items-center gap-0.5"><FileText size={10} />{file.name}:</span>}“{maskText(text, secretValues(p))}”
    </div>
  );
}

export function SuggestionCard({ s, inline }) {
  const { p, mut, jumpTo, openItem, names, me } = useP();
  const [edit, setEdit] = useState(null);
  const [sent, setSent] = useState(false);
  const target = s.targetId && p.items.find(i => i.id === s.targetId);
  const T = TYPES[s.type];
  // one click = one decision: the card disables itself until the record updates
  const act = (decision, edits) => { if (sent) return; setSent(true); mut(q => resolveSuggestion(q, me?.id || 'owner', s.id, decision, edits)); };
  const canEdit = s.op === 'create' || s.op === 'update' || s.op === 'note';
  const set = k => e => setEdit(x => ({ ...x, [k]: e.target.value }));

  return (
    <div className={cx('anim-pop rounded-xl ring-1 p-3', inline ? 'bg-[#1a1d22] ring-sky-500/15' : 'bg-[#1d1d1d] ring-white/[.07]')}>
      <div className="flex items-center gap-2">
        <span className={cx('text-[11px] font-medium px-1.5 py-0.5 rounded-md ring-1 ring-inset', COLOR[T.color].badge)}>{opLabel(s)}</span>
        <span className="text-[10px] text-neutral-600 uppercase tracking-wide">{s.askId ? 'Assistant' : engineName(s.engine, 'Rules')}</span>
        <div className="flex-1" />
        {s.msg && !inline && <button title={s.span ? 'Show the exact words in the chat' : 'Show the message'} onClick={() => jumpTo(s.msg, s.span)} className="text-neutral-500 hover:text-white"><MessageSquareQuote size={14} /></button>}
      </div>

      {edit ? (
        <div className="mt-2 space-y-2">
          <Input value={edit.title} onChange={set('title')} className="text-sm" />
          {s.type === 'sensitive' && <Input value={edit.value} onChange={set('value')} placeholder="Value" />}
          {s.type === 'task' && s.op !== 'note' && (
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={edit.due} onChange={set('due')} />
              <Select value={edit.priority} onChange={set('priority')}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></Select>
            </div>
          )}
          {s.type === 'task' && s.op === 'create' && <Select value={edit.assignee || 'owner'} onChange={set('assignee')}>{names.assignees(edit.assignee).map(([k, n]) => <option key={k} value={k}>{n} does it</option>)}</Select>}
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button size="sm" variant="primary" disabled={sent} onClick={() => act('accept', edit)}>Save & accept</Button>
          </div>
        </div>
      ) : (
        <>
          {target && s.op !== 'create' && <button onClick={() => openItem(target.id)} className="mt-2 block text-left text-xs text-neutral-500 hover:text-neutral-300 truncate w-full">{TYPES[target.type].label}: <span className={cx(!isActive(target) && 'line-through')}>{target.title}</span></button>}
          <div className="mt-1 text-sm text-neutral-100 leading-snug">{s.op === 'status' ? `→ ${STATUS[s.status]?.label}` : s.title}</div>
          {s.value && (s.type === 'sensitive' ? <div className="mt-1 text-neutral-400"><Secret value={s.value} /></div> : <div className="mt-1 text-xs text-sky-300/80 truncate">{s.value}</div>)}
          <div className="flex flex-wrap gap-1 mt-1.5 empty:hidden">
            {s.due && <Badge tone={isOverdue(s.due) ? 'rose' : 'neutral'}><Calendar size={10} />{fmtDue(s.due)}</Badge>}
            {s.priority === 'high' && <Badge tone="orange">High</Badge>}
            {s.assignee && s.assignee !== 'owner' && <Badge tone="amber">{names.of(s.assignee).split(' ')[0]} does it</Badge>}
            {s.scope === 'out' && <Badge>Out of scope</Badge>}
            {s.category && s.type !== 'task' && <Badge>{s.category}</Badge>}
          </div>
          {!inline && <SourcePassage s={s} p={p} />}
          {s.reason && <div className="mt-1.5 text-xs text-neutral-500 line-clamp-2">{s.reason}</div>}
          <div className="flex items-center gap-1.5 mt-2.5">
            <Button size="sm" variant="primary" disabled={sent} onClick={() => act('accept')}>Accept</Button>
            {canEdit && <Button size="sm" onClick={() => setEdit({ title: s.title, value: s.value, due: s.due, priority: s.priority, assignee: s.assignee })}>Edit</Button>}
            <Button size="sm" variant="ghost" disabled={sent} onClick={() => act('ignore')}>Ignore</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The suggestions a message produced, right under it in the chat. */
export function MessageSuggestions({ list, mine }) {
  const { mut, me } = useP();
  const { toast } = useStore();
  if (!list.length) return null;
  const all = decision => {
    const ids = list.map(s => s.id);
    mut(q => ids.forEach(id => resolveSuggestion(q, me?.id || 'owner', id, decision)));
    toast(`${decision === 'accept' ? 'Accepted' : 'Ignored'} ${ids.length} suggestions`);
  };
  return (
    <div className={cx('mt-1.5 w-full max-w-md space-y-1.5', mine && 'ml-auto')}>
      <div className={cx('flex items-center gap-2 text-[11px] text-sky-300/80 px-1', mine && 'justify-end')}>
        <Sparkles size={11} />{list.length} suggestion{list.length > 1 ? 's' : ''} from this message
        {list.length > 1 && <>
          <button onClick={() => all('accept')} className="flex items-center gap-1 text-neutral-300 hover:text-white"><CheckCheck size={12} />Accept all</button>
          <button onClick={() => all('ignore')} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-200"><XCircle size={12} />Ignore all</button>
        </>}
      </div>
      {list.map(s => <SuggestionCard key={s.id} s={s} inline />)}
    </div>
  );
}

/** Chat header controls for suggestions: re-read the chat, and bring back ignored ones. */
export function SuggestionTools() {
  const { p, mut, me } = useP();
  const { state, stateRef, mutate, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [ignoredOpen, setIgnoredOpen] = useState(false);
  const ignored = p.suggestions.filter(s => s.state === 'ignored').reverse();
  const unread = p.messages.filter(m => !m.analyzed).length;

  const rescan = async () => {
    setBusy(true);
    try {
      const cur = stateRef.current.projects.find(x => x.id === p.id);
      const latest = () => stateRef.current.projects.find(x => x.id === p.id);
      const { count, engine } = await analyze({ state: stateRef.current, project: cur, ids: cur.messages.filter(m => m.text?.trim() && !m.deleted).map(m => m.id), mutate, toast, latest });
      toast(count ? `✨ ${count} new suggestion${count > 1 ? 's' : ''} (${engineName(engine)})` : 'Read the whole chat — nothing new to record');
    } finally { setBusy(false); }
  };

  return (
    <>
      {unread > 0 && <span className="text-[11px] text-sky-300/80 flex items-center gap-1" title={`Read by ${aiOn(state.settings) ? aiName(state.settings) : 'built-in rules'}`}><Spinner size={10} />Reading {unread}…</span>}
      {ignored.length > 0 && <Button variant="ghost" size="sm" onClick={() => setIgnoredOpen(true)} title="Suggestions you ignored (kept, never deleted)"><Undo2 size={13} /><span className="hidden lg:inline">{ignored.length} ignored</span></Button>}
      <Button variant="ghost" size="sm" onClick={rescan} disabled={busy} title="Read the whole conversation again for suggestions">{busy ? <Spinner size={12} /> : <RefreshCw size={13} />}<span className="hidden lg:inline">Re-scan</span></Button>
      {ignoredOpen && (
        <Modal title="Ignored suggestions" sub="Kept forever. Restore one to see it under its message again." onClose={() => setIgnoredOpen(false)}>
          <div className="space-y-1">
            {ignored.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-sm text-neutral-400 py-1.5">
                <span className="flex-1 truncate">{opLabel(s)}: {s.op === 'status' ? STATUS[s.status]?.label : s.title} <span className="text-neutral-600 text-xs">· {fmtRel(s.updatedAt)}</span></span>
                <button onClick={() => mut(q => resolveSuggestion(q, me?.id || 'owner', s.id, 'restore'))} className="flex items-center gap-1 text-xs hover:text-white"><Undo2 size={12} />Restore</button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
