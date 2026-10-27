import { useMemo, useState } from 'react';
import { Search as SearchIcon, MessageSquare, FileText } from '@/lib/icons';
import { Modal, TypeIcon, Badge } from './ui';
import { TYPES, isActive } from '../lib/meta';
import { secretValues, maskText, namesFor } from '../lib/model';
import { cx, fmtDateTime } from '../lib/util';

function snippet(text, q) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 120);
  const s = Math.max(0, i - 40);
  return (s ? '…' : '') + text.slice(s, i + q.length + 80);
}
function Hl({ text, q }) {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0 || !q) return text;
  return <>{text.slice(0, i)}<mark className="bg-amber-soft text-warn-ink rounded px-0.5">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

/**
 * Search across chat, tasks, requirements, decisions, files, summaries.
 * Sensitive values are never searched or shown — only their titles.
 */
export default function SearchModal({ projects, onPick, onClose, names }) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const ql = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (ql.length < 2) return [];
    const out = [];
    for (const p of projects) {
      const secrets = secretValues(p);
      for (const m of p.messages) {
        const hay = maskText([m.text || '', ...m.attachments.map(a => a.name)].join(' '), secrets);
        if (hay.toLowerCase().includes(ql)) out.push({ p, kind: 'message', id: m.id, ts: m.ts, title: snippet(hay, ql), m });
      }
      for (const it of p.items) {
        const hay = it.title + ' ' + (it.detail || '') + (it.type === 'file' ? ' ' + (it.value || '') + ' ' + (it.category || '') : '');
        if (hay.toLowerCase().includes(ql)) out.push({ p, kind: 'item', id: it.id, ts: it.createdAt, title: it.title, it });
      }
      for (const s of p.summaries) {
        const hay = [s.headline, s.overview].join(' ');
        if (hay.toLowerCase().includes(ql)) out.push({ p, kind: 'summary', id: s.id, ts: s.ts, title: snippet(hay, ql) });
      }
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, 80);
  }, [projects, ql]);
  const shown = kind === 'all' ? results : results.filter(r => (kind === 'message' || kind === 'summary' ? r.kind === kind : r.it?.type === kind));
  const tabs = [['all', 'All'], ['message', 'Chat'], ['task', 'Tasks'], ['requirement', 'Requirements'], ['decision', 'Decisions'], ['file', 'Files'], ['sensitive', 'Sensitive'], ['summary', 'Memory']];

  return (
    <Modal wide title="Search" onClose={onClose}>
      <div className="flex items-center gap-2 bg-background ring-1 ring-border rounded-xl px-3 py-2.5 focus-within:ring-ring">
        <SearchIcon size={17} className="text-muted-foreground" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={projects.length > 1 ? 'Search every project…' : 'Search chat, tasks, requirements, decisions, files…'} className="flex-1 bg-transparent outline-none" />
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setKind(k)} className={cx('px-2.5 py-1 rounded-lg text-xs', kind === k ? 'bg-card text-text-figure shadow-button' : 'text-muted-foreground hover:bg-field-hover')}>{l}</button>)}
      </div>
      <div className="mt-3 space-y-0.5 min-h-[200px]">
        {ql.length < 2 && <div className="text-sm text-muted-foreground text-center py-10">Type at least two characters.</div>}
        {ql.length >= 2 && !shown.length && <div className="text-sm text-muted-foreground text-center py-10">No matches for “{q}”.</div>}
        {shown.map(r => (
          <button key={r.p.id + r.id} onClick={() => onPick(r)} className="w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-field-hover">
            {r.kind === 'item' ? <TypeIcon type={r.it.type} size="sm" /> : <span className="w-6 h-6 rounded-lg bg-field grid place-items-center text-muted-foreground shrink-0">{r.kind === 'message' ? <MessageSquare size={13} /> : <FileText size={13} />}</span>}
            <div className="min-w-0 flex-1">
              <div className={cx('text-sm', r.it && !isActive(r.it) && 'line-through text-muted-foreground')}><Hl text={r.title} q={ql} /></div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                {projects.length > 1 && <Badge>{r.p.name}</Badge>}
                {r.kind === 'message' ? `${r.m.from === 'owner' ? names?.owner || 'You' : namesFor(r.p).msg(r.m)} · ` : r.kind === 'item' ? `${TYPES[r.it.type].label} · ` : 'Memory · '}{fmtDateTime(r.ts)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
