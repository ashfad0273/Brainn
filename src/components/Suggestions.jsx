import { useState } from 'react';
import { Sparkles, MessageSquareQuote, RefreshCw, ChevronDown, Undo2, CheckCheck, Calendar } from 'lucide-react';
import { useStore } from '../store';
import { useP, Button, Badge, Input, Select, Spinner, Secret } from './ui';
import { resolveSuggestion } from '../lib/model';
import { analyze, geminiOn } from '../lib/brain';
import { TYPES, STATUS, COLOR, isActive } from '../lib/meta';
import { cx, fmtDue, fmtRel, isOverdue } from '../lib/util';

const opLabel = s => {
  const t = TYPES[s.type].label.toLowerCase();
  if (s.op === 'create') return s.type === 'file' ? 'New link' : s.replaces ? `New ${t} (replaces old)` : `New ${t}`;
  if (s.op === 'update') return `Update ${t}`;
  if (s.op === 'status') return `Mark ${STATUS[s.status]?.label.toLowerCase()}`;
  return `Note on ${t}`;
};

export function SuggestionCard({ s }) {
  const { p, mut, jumpTo, openItem, names } = useP();
  const [edit, setEdit] = useState(null);
  const target = s.targetId && p.items.find(i => i.id === s.targetId);
  const T = TYPES[s.type];
  const act = (decision, edits) => mut(q => resolveSuggestion(q, 'owner', s.id, decision, edits));
  const canEdit = s.op === 'create' || s.op === 'update' || s.op === 'note';
  const set = k => e => setEdit(x => ({ ...x, [k]: e.target.value }));

  return (
    <div className="anim-pop rounded-xl bg-[#1d1d1d] ring-1 ring-white/[.07] p-3">
      <div className="flex items-center gap-2">
        <span className={cx('text-[11px] font-medium px-1.5 py-0.5 rounded-md ring-1 ring-inset', COLOR[T.color].badge)}>{opLabel(s)}</span>
        <span className="text-[10px] text-neutral-600 uppercase tracking-wide">{s.askId ? 'Assistant' : s.engine === 'gemini' ? 'Gemini' : 'Rules'}</span>
        <div className="flex-1" />
        {s.msg && <button title="Show the message" onClick={() => jumpTo(s.msg)} className="text-neutral-500 hover:text-white"><MessageSquareQuote size={14} /></button>}
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
          {s.type === 'task' && s.op === 'create' && <Select value={edit.assignee || 'owner'} onChange={set('assignee')}><option value="owner">{names.owner} does it</option><option value="client">{names.client} does it</option></Select>}
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
            <Button size="sm" variant="primary" onClick={() => act('accept', edit)}>Save & accept</Button>
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
            {s.assignee === 'client' && <Badge tone="amber">{names.client.split(' ')[0]} does it</Badge>}
            {s.scope === 'out' && <Badge>Out of scope</Badge>}
            {s.category && s.type !== 'task' && <Badge>{s.category}</Badge>}
          </div>
          {s.reason && <div className="mt-1.5 text-xs text-neutral-500 line-clamp-2">{s.reason}</div>}
          <div className="flex items-center gap-1.5 mt-2.5">
            <Button size="sm" variant="primary" onClick={() => act('accept')}>Accept</Button>
            {canEdit && <Button size="sm" onClick={() => setEdit({ title: s.title, value: s.value, due: s.due, priority: s.priority, assignee: s.assignee })}>Edit</Button>}
            <Button size="sm" variant="ghost" onClick={() => act('ignore')}>Ignore</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function SuggestionsInbox() {
  const { p, mut } = useP();
  const { state, stateRef, mutate, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const pending = p.suggestions.filter(s => s.state === 'pending');
  const ignored = p.suggestions.filter(s => s.state === 'ignored').reverse();
  const unread = p.messages.filter(m => !m.analyzed).length;

  const rescan = async () => {
    setBusy(true);
    try {
      const cur = stateRef.current.projects.find(x => x.id === p.id);
      const { count, engine } = await analyze({ state: stateRef.current, project: cur, ids: cur.messages.filter(m => m.text?.trim()).map(m => m.id), mutate, toast });
      toast(count ? `✨ ${count} new suggestion${count > 1 ? 's' : ''} (${engine === 'gemini' ? 'Gemini' : 'built-in rules'})` : 'Read the whole chat — nothing new to record');
    } finally { setBusy(false); }
  };
  const acceptAll = () => mut(q => pending.forEach(s => resolveSuggestion(q, 'owner', s.id, 'accept')));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-sky-300" />
        <div className="text-sm font-semibold flex-1">Suggestions {pending.length > 0 && <span className="text-neutral-500 font-normal">{pending.length}</span>}</div>
        {pending.length > 1 && <Button size="xs" variant="ghost" onClick={acceptAll} title="Accept every pending suggestion"><CheckCheck size={13} />All</Button>}
        <Button size="xs" variant="ghost" onClick={rescan} disabled={busy} title="Read the whole conversation again">{busy ? <Spinner size={11} /> : <RefreshCw size={12} />}Re-scan</Button>
      </div>
      <p className="text-xs text-neutral-500">Only you see these. {geminiOn(state.settings) ? 'Read by Gemini.' : 'Read by built-in rules — add a Gemini key for deeper understanding.'}{unread ? ` Reading ${unread} new message${unread > 1 ? 's' : ''}…` : ''}</p>
      {pending.length === 0 && <div className="text-sm text-neutral-500 rounded-xl border border-dashed border-white/10 p-4 text-center">All caught up. New messages are read automatically.</div>}
      {pending.map(s => <SuggestionCard key={s.id} s={s} />)}
      {ignored.length > 0 && (
        <div className="pt-1">
          <button onClick={() => setShowIgnored(!showIgnored)} className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
            <ChevronDown size={13} className={cx('transition', showIgnored && 'rotate-180')} />{ignored.length} ignored (kept, never deleted)
          </button>
          {showIgnored && ignored.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-xs text-neutral-500 py-1.5 px-1">
              <span className="flex-1 truncate">{opLabel(s)}: {s.op === 'status' ? STATUS[s.status]?.label : s.title} <span className="text-neutral-700">· {fmtRel(s.updatedAt)}</span></span>
              <button onClick={() => mut(q => resolveSuggestion(q, 'owner', s.id, 'restore'))} className="flex items-center gap-1 hover:text-white"><Undo2 size={12} />Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Right-hand column next to the chat (owner only). */
export function ChatSidebar() {
  const { p, openItem } = useP();
  const open = p.items.filter(i => i.type === 'task' && isActive(i)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'));
  const decs = p.items.filter(i => i.type === 'decision' && isActive(i)).slice(-3).reverse();
  const qs = p.items.filter(i => (i.type === 'question' || i.type === 'risk') && isActive(i));
  return (
    <aside className="w-[340px] shrink-0 border-l border-white/[.06] bg-[#151515] overflow-auto p-4 space-y-6 hidden xl:block">
      <SuggestionsInbox />
      <div>
        <div className="text-sm font-semibold mb-2">Open tasks <span className="text-neutral-500 font-normal">{open.length}</span></div>
        {open.length === 0 && <div className="text-xs text-neutral-600">None</div>}
        {open.slice(0, 6).map(t => (
          <button key={t.id} onClick={() => openItem(t.id)} className="w-full flex items-center gap-2 text-left text-sm py-1.5 px-1 rounded-lg hover:bg-white/[.04]">
            <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', t.status === 'blocked' ? 'bg-rose-400' : t.status === 'in_progress' ? 'bg-amber-400' : 'bg-sky-400')} />
            <span className="flex-1 truncate text-neutral-300">{t.title}</span>
            {t.due && <span className={cx('text-xs', isOverdue(t.due) ? 'text-rose-300' : 'text-neutral-500')}>{fmtDue(t.due)}</span>}
          </button>
        ))}
      </div>
      {decs.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Recent decisions</div>
          {decs.map(d => <button key={d.id} onClick={() => openItem(d.id)} className="w-full text-left text-sm py-1.5 px-1 rounded-lg hover:bg-white/[.04] text-neutral-300 truncate block">{d.title}</button>)}
        </div>
      )}
      {qs.length > 0 && (
        <div>
          <div className="text-sm font-semibold mb-2">Open questions & risks</div>
          {qs.map(d => <button key={d.id} onClick={() => openItem(d.id)} className="w-full text-left text-sm py-1.5 px-1 rounded-lg hover:bg-white/[.04] text-neutral-300 truncate block">{d.type === 'risk' ? '⚠ ' : '? '}{d.title}</button>)}
        </div>
      )}
    </aside>
  );
}
