import { useState } from 'react';
import { Brain, RefreshCw, Clock } from 'lucide-react';
import { useStore } from '../store';
import { useP, Button, Spinner, Section, Badge } from './ui';
import { ItemRow } from './Items';
import Assistant from './Assistant';
import { refreshMemory, localSummary, aiOn, aiName } from '../lib/brain';
import { engineName } from '../lib/gemini';
import { isActive } from '../lib/meta';
import { cx, fmtDateTime, fmtRel } from '../lib/util';

function Refs({ refs }) {
  const { p, openItem, jumpTo } = useP();
  if (!refs?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 ml-1.5 align-middle">
      {refs.slice(0, 4).map(r => {
        const it = p.items.find(i => i.id === r);
        const m = !it && p.messages.find(x => x.id === r);
        if (!it && !m) return null;
        return <button key={r} onClick={() => (it ? openItem(r) : jumpTo(r))} className="text-[10px] px-1.5 py-px rounded bg-white/5 text-neutral-400 hover:text-white hover:bg-white/10">{it ? 'record' : 'msg'} ↗</button>;
      })}
    </span>
  );
}

const LISTS = [['keyFacts', 'What we know so far'], ['done', 'Done'], ['inProgress', 'In progress'], ['next', 'Next'], ['openQuestions', 'Open questions'], ['risks', 'Risks'], ['recentChanges', 'Recent changes']];

function SummaryCard({ s, live }) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-sky-500/[.07] to-violet-500/[.05] ring-1 ring-white/[.07] p-5">
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Brain size={14} className="text-sky-300" />
        {live ? 'Live view from the records' : <>Memory from {fmtDateTime(s.ts)} · {engineName(s.engine, 'built from records')}</>}
      </div>
      {s.headline && <h2 className="text-lg font-semibold mt-2 leading-snug">{s.headline}</h2>}
      {s.overview && <p className="text-sm text-neutral-300 mt-2 leading-relaxed">{s.overview}</p>}
      <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 mt-5">
        {LISTS.filter(([k]) => s[k]?.length).map(([k, label]) => (
          <div key={k}>
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">{label}</div>
            <ul className="space-y-1">
              {s[k].map((x, i) => <li key={i} className="text-sm text-neutral-200 flex gap-2"><span className="text-neutral-600">•</span><span>{x.text}<Refs refs={x.refs} /></span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MemoryView() {
  const { p, role, jumpTo, openItem } = useP();
  const { state, stateRef, mutate, toast } = useStore();
  const owner = role === 'owner';
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const sums = p.summaries;
  const latest = sums[sums.length - 1];
  const cur = (sel && sums.find(s => s.id === sel)) || latest;
  const stale = latest ? p.log.filter(e => e.ts > latest.ts && !['memory.refresh', 'ask'].includes(e.action)).length : 0;
  const questions = p.items.filter(i => i.type === 'question' && isActive(i));
  const risks = p.items.filter(i => i.type === 'risk' && isActive(i));

  const refresh = async () => {
    setBusy(true);
    try { const s = await refreshMemory({ state: stateRef.current, project: stateRef.current.projects.find(x => x.id === p.id), mutate, toast }); setSel(null); toast(s.engine !== 'rules' ? `🧠 Memory refreshed by ${engineName(s.engine)}` : '🧠 Memory rebuilt from the records'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-4 min-w-0">
          {owner && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 text-sm text-neutral-500">
                {latest ? <>Last refreshed {fmtRel(latest.ts)}{stale > 0 && <span className="text-amber-300"> · {stale} change{stale > 1 ? 's' : ''} since</span>}</> : 'No saved memory yet — showing a live view built from the records.'}
              </div>
              <Button variant="primary" size="sm" onClick={refresh} disabled={busy}>{busy ? <Spinner size={12} /> : <RefreshCw size={13} />}{aiOn(state.settings) ? `Refresh with ${aiName(state.settings)}` : 'Refresh memory'}</Button>
            </div>
          )}
          {cur ? <SummaryCard s={cur} /> : <SummaryCard s={localSummary(p)} live />}
          {owner && sel && sel !== latest?.id && <Button size="sm" variant="ghost" onClick={() => setSel(null)}>← Back to the latest memory</Button>}

          {owner && <Assistant />}
        </div>

        <div className="space-y-4">
          <Section title="Open questions" count={questions.length}>{questions.length ? questions.map(i => <ItemRow key={i.id} it={i} />) : <div className="text-xs text-neutral-600 px-3 pb-2">None</div>}</Section>
          <Section title="Risks" count={risks.length}>{risks.length ? risks.map(i => <ItemRow key={i.id} it={i} />) : <div className="text-xs text-neutral-600 px-3 pb-2">None</div>}</Section>
          {owner && sums.length > 0 && (
            <Section title="Memory timeline" count={sums.length}>
              {[...sums].reverse().map(s => (
                <button key={s.id} onClick={() => setSel(s.id)} className={cx('w-full text-left px-3 py-2 rounded-xl hover:bg-white/[.04]', cur?.id === s.id && 'bg-white/[.06]')}>
                  <div className="text-xs text-neutral-500 flex items-center gap-1.5"><Clock size={11} />{fmtDateTime(s.ts)} {s.engine !== 'rules' && <Badge tone="sky">{engineName(s.engine)}</Badge>}</div>
                  <div className="text-sm text-neutral-300 line-clamp-2 mt-0.5">{s.headline}</div>
                </button>
              ))}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
