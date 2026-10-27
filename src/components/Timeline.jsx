import { useMemo, useState } from 'react';
import { History, Braces, Download } from '@/lib/icons';
import { useP, Button, Modal, Toggle, Empty } from './ui';
import { TYPES, STATUS, MEMBER_ROLES } from '../lib/meta';
import { engineName } from '../lib/gemini';
import { cx, fmtDateTime, fmtDay, download } from '../lib/util';

function describe(e, p, who) {
  const it = e.ref && p.items.find(i => i.id === e.ref);
  const title = it ? `“${it.title}”` : '';
  const d = e.data || {};
  switch (e.action) {
    case 'project.create': return `${who} created the project`;
    case 'project.update': return `${who} updated project details`;
    case 'project.archive': return `${who} archived the project`;
    case 'project.unarchive': return `${who} restored the project from the archive`;
    case 'message.add': return `${who} sent a message${d.files ? ` with ${d.files} file${d.files > 1 ? 's' : ''}` : ''}`;
    case 'item.create': return `${who} recorded ${TYPES[d.type]?.label.toLowerCase() || 'a record'} “${d.title}”`;
    case 'item.status': return `${who} moved ${title} from ${STATUS[d.from]?.label} to ${STATUS[d.to]?.label}`;
    case 'item.edit': return `${who} changed ${(d.fields || []).join(', ')} of ${title}`;
    case 'item.note': return `${who} added a note to ${title}`;
    case 'suggestions.add': return `Project brain (${engineName(d.engine, 'rules')}) proposed ${d.count} suggestion${d.count > 1 ? 's' : ''}`;
    case 'suggestion.accept': return `${who} accepted: ${TYPES[d.type]?.label.toLowerCase()} “${d.title || ''}”`;
    case 'suggestion.ignore': return `${who} ignored a suggestion: “${d.title}”`;
    case 'suggestion.restore': return `${who} restored an ignored suggestion: “${d.title}”`;
    case 'memory.refresh': return `${who} refreshed the project memory (${engineName(d.engine, 'records')})`;
    case 'ask': return `${who} asked: “${d.question}”`;
    case 'invite.create': return `${who} invited ${d.name}`;
    case 'member.add': return `${who} invited ${d.name} as ${d.role === 'other' ? d.designation || 'a member' : MEMBER_ROLES[d.role]?.toLowerCase() || 'a member'}`;
    case 'member.update': return `${who} updated ${d.name}'s details`;
    case 'member.perms': return `${who} changed what ${d.name} can see`;
    case 'member.reset': return `${who} gave ${d.name} a new PIN and link`;
    case 'member.revoke': return `${who} revoked ${d.name}'s access`;
    case 'item.delete': return `${who} deleted ${TYPES[d.type]?.label.toLowerCase() || 'a record'} “${d.title}”${d.reason ? ` (${d.reason})` : ''}`;
    case 'file.read': return `${who} had ${title || 'a file'} read by ${engineName(d.engine)}${d.suggestions ? ` — ${d.suggestions} suggestion${d.suggestions > 1 ? 's' : ''}` : ''}`;
    case 'invite.perms': return `${who} changed what the client can see`;
    case 'invite.revoke': return `${who} revoked ${d.name}'s access`;
    default: return `${who}: ${e.action}`;
  }
}

function RawJson({ p, onClose }) {
  const [show, setShow] = useState(false);
  const text = useMemo(() => {
    let j = JSON.stringify(p, (k, v) => (k === 'dataUrl' && v ? `[${Math.round(v.length / 1365)} KB file]` : v), 2);
    if (!show) {
      const secrets = [...new Set(p.items.filter(i => i.type === 'sensitive' && i.value).map(i => i.value)
        .concat(p.suggestions.filter(s => s.type === 'sensitive' && s.value).map(s => s.value)))].filter(v => v.length >= 3);
      secrets.forEach(s => { j = j.split(JSON.stringify(s).slice(1, -1)).join('••••••'); });
    }
    return j;
  }, [p, show]);
  return (
    <Modal wide title="Project record (JSON)" sub="The single source of truth for this project. It only ever grows." onClose={onClose}
      footer={<><div className="flex-1"><Toggle checked={show} onChange={setShow} label="Show sensitive values" /></div>
        <Button onClick={() => download(`${p.name.replace(/\W+/g, '-').toLowerCase()}-record.json`, JSON.stringify(p, null, 2))}><Download size={14} />Download full record</Button></>}>
      <pre className="text-xs leading-relaxed bg-modal-scrim rounded-xl p-4 overflow-auto max-h-[60vh] text-foreground">{text}</pre>
    </Modal>
  );
}

export default function TimelineView() {
  const { p, names, openItem, jumpTo } = useP();
  const [f, setF] = useState('all');
  const [raw, setRaw] = useState(false);
  const who = a => (a === 'system' ? 'System' : names.of(a));
  const FILTERS = [['all', 'Everything'], ['message', 'Messages'], ['item', 'Records'], ['suggestion', 'Suggestions'], ['other', 'Other']];
  const events = [...p.log].reverse().filter(e => f === 'all' || (f === 'other' ? !/^(message|item|suggestion)/.test(e.action) : e.action.startsWith(f)));
  let last = '';
  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <div className="flex bg-card ring-1 ring-border rounded-xl p-0.5">
            {FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={cx('px-3 py-1.5 rounded-lg text-sm', f === k ? 'bg-field-hover text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>)}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{p.log.length} events</span>
          <Button size="sm" onClick={() => setRaw(true)}><Braces size={14} />Raw JSON</Button>
        </div>
        {!events.length && <Empty icon={History} title="Nothing here yet" />}
        <ol className="space-y-0.5">
          {events.map(e => {
            const day = fmtDay(e.ts), sep = day !== last;
            last = day;
            const it = e.ref && p.items.find(i => i.id === e.ref);
            const isMsg = e.action === 'message.add';
            return (
              <li key={e.id}>
                {sep && <div className="text-label-mono text-muted-foreground pt-4 pb-1.5">{day}</div>}
                <button onClick={() => (isMsg ? jumpTo(e.ref) : it ? openItem(it.id) : null)} className={cx('w-full text-left flex gap-3 px-3 py-2 rounded-xl', (isMsg || it) && 'hover:bg-field-hover')}>
                  <span className="text-xs text-text-tertiary w-12 shrink-0 pt-0.5 tabular-nums">{fmtDateTime(e.ts).split(', ').pop()}</span>
                  <span className={cx('w-1.5 h-1.5 rounded-full mt-2 shrink-0', e.actor === 'owner' ? 'bg-primary' : e.actor === 'system' ? 'bg-violet' : 'bg-orange')} />
                  <span className="text-sm text-foreground">{describe(e, p, who(e.actor))}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {raw && <RawJson p={p} onClose={() => setRaw(false)} />}
    </div>
  );
}
