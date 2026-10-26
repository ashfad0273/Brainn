import { useEffect, useRef, useState } from 'react';
import { Sparkles, ArrowUp, Copy, Send, CheckCheck, ListPlus, ListChecks, Clock, Mail, MessageSquareReply, CalendarDays, GitCompare, History, Check, X } from 'lucide-react';
import { useStore } from '../store';
import { useP, Button, Spinner, Badge } from './ui';
import { SuggestionCard } from './Suggestions';
import { askProject } from '../lib/assistant';
import { aiOn, aiName } from '../lib/brain';
import { engineName } from '../lib/gemini';
import { addMessage, resolveSuggestion } from '../lib/model';
import { TYPES, STATUS } from '../lib/meta';
import { cx, fmtRel, copyText } from '../lib/util';

const QUICK = [
  [ListPlus, 'Risks → tasks', 'Create tasks for all the open risks'],
  [ListChecks, 'Fill task gaps', 'Which requirements have no task yet? Create tasks for them'],
  [Clock, "What's stuck?", "What's overdue, blocked or waiting on the client?"],
  [Mail, 'Client update', 'Draft a progress update for the client'],
  [MessageSquareReply, 'Draft reply', "Draft a reply to the client's last message"],
  [CalendarDays, 'Call agenda', 'Prepare an agenda for our next call'],
  [History, 'This week', 'What changed this week?'],
  [GitCompare, 'Find conflicts', 'Are there conflicting or outdated requirements or decisions? Propose fixes'],
];

function Refs({ refs }) {
  const { p, openItem, jumpTo } = useP();
  if (!refs?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {refs.slice(0, 8).map(r => {
        const it = p.items.find(i => i.id === r);
        const m = !it && p.messages.find(x => x.id === r);
        if (!it && !m) return null;
        return (
          <button key={r} onClick={() => (it ? openItem(r) : jumpTo(r))} className="text-[11px] px-1.5 py-0.5 rounded bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10 max-w-[220px] truncate">
            {it ? `${TYPES[it.type].label}: ${it.title}` : 'Message'} ↗
          </button>
        );
      })}
    </div>
  );
}

function Draft({ text }) {
  const { mut } = useP();
  const { toast } = useStore();
  const [value, setValue] = useState(text);
  const [sent, setSent] = useState(false);
  return (
    <div className="mt-3 rounded-xl bg-black/30 ring-1 ring-white/10">
      <div className="px-3 pt-2 text-[11px] uppercase tracking-wide text-neutral-500">Draft — edit before sending</div>
      <textarea value={value} onChange={e => setValue(e.target.value)} rows={Math.min(12, value.split('\n').length + 1)}
        className="w-full bg-transparent px-3 py-2 text-sm text-neutral-100 outline-none resize-y" />
      <div className="flex gap-1.5 px-2 pb-2">
        <Button size="sm" onClick={async () => toast((await copyText(value)) ? 'Copied' : 'Copy blocked by the browser')}><Copy size={13} />Copy</Button>
        <Button size="sm" variant="accent" disabled={sent || !value.trim()} onClick={() => { mut(q => addMessage(q, { from: 'owner', text: value.trim() })); setSent(true); toast('Sent in the project chat'); }}>
          <Send size={13} />{sent ? 'Sent' : 'Send in chat'}
        </Button>
      </div>
    </div>
  );
}

function Proposals({ ids }) {
  const { p, mut, openItem } = useP();
  const list = ids.map(id => p.suggestions.find(s => s.id === id)).filter(Boolean);
  if (!list.length) return null;
  const pending = list.filter(s => s.state === 'pending');
  const done = list.filter(s => s.state !== 'pending');
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400 flex-1">{list.length} proposed change{list.length > 1 ? 's' : ''}{pending.length ? ` · ${pending.length} waiting for you` : ' · all reviewed'}</span>
        {pending.length > 1 && <Button size="xs" variant="primary" onClick={() => mut(q => pending.forEach(s => resolveSuggestion(q, 'owner', s.id, 'accept')))}><CheckCheck size={12} />Accept all {pending.length}</Button>}
        {pending.length > 1 && <Button size="xs" variant="ghost" onClick={() => mut(q => pending.forEach(s => resolveSuggestion(q, 'owner', s.id, 'ignore')))}>Ignore all</Button>}
      </div>
      {pending.map(s => <SuggestionCard key={s.id} s={s} />)}
      {done.length > 0 && (
        <div className="space-y-0.5">
          {done.map(s => (
            <button key={s.id} onClick={() => s.resultId && openItem(s.resultId)} className="w-full text-left flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 px-1 py-0.5">
              {s.state === 'accepted' ? <Check size={12} className="text-emerald-400" /> : <X size={12} />}
              <span className="truncate">{s.op === 'status' ? `${STATUS[s.status]?.label}: ${p.items.find(i => i.id === s.targetId)?.title || ''}` : s.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Project assistant: ask, command ("create tasks for all risks"), or draft. Changes are proposed, never applied silently. */
export default function Assistant({ compact }) {
  const { p } = useP();
  const { state, stateRef, mutate, toast } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const ta = useRef();
  const gem = aiOn(state.settings);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, [q]);

  const run = async text => {
    const question = (text ?? q).trim();
    if (!question || busy) return;
    setBusy(true);
    try {
      const cur = stateRef.current.projects.find(x => x.id === p.id);
      const e = await askProject({ state: stateRef.current, project: cur, mutate, toast, question });
      setQ('');
      if (e.suggestionIds.length) toast(`✨ ${e.suggestionIds.length} change${e.suggestionIds.length > 1 ? 's' : ''} proposed — review below`);
    } finally { setBusy(false); }
  };
  const asks = [...p.asks].reverse().slice(0, compact ? 12 : 20);

  return (
    <div className={cx(!compact && 'rounded-2xl bg-[#181818] ring-1 ring-white/[.06] p-4')}>
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-sky-300" />
        <div className="text-sm font-semibold flex-1">Project assistant</div>
        <Badge tone={gem ? 'emerald' : 'neutral'}>{gem ? aiName(state.settings) : 'Built-in'}</Badge>
      </div>
      <p className="text-xs text-neutral-500 mt-1">Ask anything, tell it to create or update records, or have it write for you. Changes come back as proposals you approve.</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {QUICK.map(([I, label, prompt]) => (
          <button key={label} disabled={busy} onClick={() => run(prompt)} title={prompt}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg ring-1 ring-inset ring-white/10 text-neutral-300 hover:bg-white/5 hover:text-white disabled:opacity-40 transition">
            <I size={13} />{label}
          </button>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); run(); }} className="mt-3 flex items-end gap-2 bg-[#111] ring-1 ring-white/10 rounded-xl px-3 py-2 focus-within:ring-sky-500/60">
        <textarea ref={ta} rows={1} value={q} onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
          placeholder="e.g. create tasks about all the risks · split the About page into subtasks · what did Sara say about the logo?"
          className="flex-1 bg-transparent outline-none resize-none text-sm py-1 placeholder:text-neutral-600" />
        <button type="submit" disabled={busy || !q.trim()} className="h-8 w-8 rounded-lg grid place-items-center bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-30">{busy ? <Spinner /> : <ArrowUp size={16} />}</button>
      </form>
      {!gem && <p className="text-[11px] text-neutral-600 mt-1.5">Built-in mode understands the quick actions and simple commands. Connect Cloudflare AI or Gemini in Settings → AI for open-ended requests.</p>}

      <div className="mt-4 space-y-5">
        {asks.map(a => (
          <div key={a.id} className="anim-up">
            <div className="flex justify-end"><div className="max-w-[85%] text-sm bg-white/[.06] rounded-2xl rounded-tr-md px-3 py-2 text-neutral-200">{a.question}</div></div>
            <div className="mt-2 text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed">{a.answer}</div>
            <div className="text-[11px] text-neutral-600 mt-1">{fmtRel(a.ts)} · {engineName(a.engine, 'built-in')}</div>
            <Refs refs={a.refs} />
            {a.draft && <Draft text={a.draft} />}
            {a.suggestionIds?.length > 0 && <Proposals ids={a.suggestionIds} />}
          </div>
        ))}
      </div>
    </div>
  );
}
