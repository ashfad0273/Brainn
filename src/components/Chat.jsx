import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Mic, ArrowUp, Square, X, Download, FileText, Search, MoreHorizontal, Repeat, Plus, Copy, Sparkles } from 'lucide-react';
import { useStore } from '../store';
import { useP, Button, Menu, MenuItem, Badge, Empty } from './ui';
import { ItemFormModal } from './Items';
import { addMessage, secretValues } from '../lib/model';
import { TYPES, TYPE_ORDER, COLOR } from '../lib/meta';
import { toAttachment } from '../lib/files';
import { hasFile, useAttachmentUrl } from '../lib/blobs';
import { ImageThumb, useDownload } from './Viewer';
import { cx, fmtTime, fmtDay, fmtSize, flash, copyText } from '../lib/util';
import { cleanTitle } from '../lib/extract';

const URL_RE = /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/gi;

function Linkified({ text }) {
  return text.split(URL_RE).map((part, i) => (i % 2
    ? <a key={i} href={part.startsWith('http') ? part : 'https://' + part} target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:decoration-white break-all">{part}</a>
    : <Fragment key={i}>{part}</Fragment>));
}

/** Message text with sensitive values masked (click to reveal). */
function MaskedText({ text, secrets }) {
  const [shown, setShown] = useState({});
  let parts = [text];
  secrets.forEach(s => {
    parts = parts.flatMap(x => (typeof x !== 'string' ? [x] : x.split(s).flatMap((y, i, a) => (i < a.length - 1 ? [y, { secret: s }] : [y]))));
  });
  return parts.map((x, i) => (typeof x === 'string'
    ? <Linkified key={i} text={x} />
    : <button type="button" key={i} title={shown[i] ? 'Hide' : 'Sensitive — click to reveal'} onClick={() => setShown(v => ({ ...v, [i]: !v[i] }))}
        className="inline rounded px-1.5 mx-0.5 bg-black/30 ring-1 ring-rose-400/40 font-mono text-[0.9em]">{shown[i] ? x.secret : '••••••'}</button>));
}

function VoiceNote({ a }) {
  const { url } = useAttachmentUrl(a);
  return <div className="mt-2">{url ? <audio controls src={url} className="h-10 max-w-full" /> : <span className="text-xs text-neutral-500">{hasFile(a) ? 'Loading voice note…' : 'Voice note (audio too large to keep in the browser)'}</span>}</div>;
}

function Attachment({ a }) {
  const dl = useDownload();
  if (a.kind === 'image' && hasFile(a)) {
    return <ImageThumb a={a} className="block mt-2 cursor-zoom-in" imgClass="max-h-64 rounded-xl ring-1 ring-white/10" />;
  }
  if (a.kind === 'voice') return <VoiceNote a={a} />;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#1d1d1d] ring-1 ring-white/10 px-3 py-2 max-w-sm">
      <span className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-300 grid place-items-center shrink-0"><FileText size={17} /></span>
      <div className="min-w-0 flex-1"><div className="text-sm truncate text-neutral-100">{a.name}</div><div className="text-xs text-neutral-500">{a.category} · {fmtSize(a.size)}</div></div>
      {hasFile(a)
        ? <button onClick={() => dl(a)} title="Download" className="text-neutral-400 hover:text-white"><Download size={16} /></button>
        : <span className="text-[10px] text-neutral-600" title="Only the file details were stored">no copy</span>}
    </div>
  );
}

function Message({ m, secrets, linked, onRecord }) {
  const { role, names, openItem } = useP();
  const { toast } = useStore();
  const owner = role === 'owner';
  const mine = m.from === role;
  const name = m.from === 'owner' ? names.owner : names.client;
  return (
    <div id={'msg-' + m.id} className={cx('group flex gap-3 px-2 py-1 anim-up', mine && 'flex-row-reverse')}>
      <div className={cx('w-8 h-8 rounded-lg shrink-0 grid place-items-center text-xs font-semibold text-white', m.from === 'owner' ? 'bg-sky-600' : 'bg-orange-600')}>{(name || '?')[0].toUpperCase()}</div>
      <div className={cx('max-w-[78%] min-w-0 flex flex-col', mine ? 'items-end' : 'items-start')}>
        <div className="text-[11px] text-neutral-500 mb-1 px-1">{name} · {fmtTime(m.ts)}</div>
        <div className={cx('flex items-center gap-1', mine && 'flex-row-reverse')}>
          {(m.text || m.voice) && (
            <div className={cx('rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words', mine ? 'bg-sky-600 text-white rounded-tr-md' : 'bg-[#242424] text-neutral-100 rounded-tl-md')}>
              {m.voice && <div className="text-xs opacity-70 mb-1 flex items-center gap-1"><Mic size={12} />Voice note · {m.voice.duration}s{m.text ? ' · transcript' : ''}</div>}
              {m.text ? <MaskedText text={m.text} secrets={secrets} /> : <span className="opacity-60 text-sm">No transcript</span>}
            </div>
          )}
          {owner && (
            <Menu align={mine ? 'right' : 'left'} trigger={toggle => (
              <button onClick={toggle} title="More" className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition"><MoreHorizontal size={16} /></button>
            )}>
              <div className="px-3 pt-1.5 pb-1 text-[11px] uppercase tracking-wide text-neutral-500">Record from this message</div>
              {TYPE_ORDER.filter(t => t !== 'file').map(t => <MenuItem key={t} icon={TYPES[t].icon} onClick={() => onRecord(t, m)}>{TYPES[t].label}</MenuItem>)}
              {m.text && <MenuItem icon={Copy} onClick={async () => toast((await copyText(m.text)) ? 'Copied' : 'Copy blocked')}>Copy text</MenuItem>}
            </Menu>
          )}
        </div>
        {m.attachments.map(a => <Attachment key={a.id} a={a} />)}
        {owner && linked.length > 0 && (
          <div className={cx('flex flex-wrap gap-1 mt-1.5', mine && 'justify-end')}>
            {linked.map(({ it, done }) => (
              <button key={it.id + done} onClick={() => openItem(it.id)} className={cx('text-[11px] px-2 py-0.5 rounded-md ring-1 ring-inset hover:-translate-y-px transition', COLOR[TYPES[it.type].color].badge)}>
                {done === 'updated' ? '↻ updated' : done === 'note' ? '✎ note' : done ? `✓ ${done}` : TYPES[it.type].label}:{it.title.length > 32 ? it.title.slice(0, 32) + '…' : it.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function useRecorder(onDone) {
  const { toast } = useStore();
  const [rec, setRec] = useState(null);
  const [, tick] = useState(0);
  const r = useRef({});
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => { if (!rec) return; const h = setInterval(() => tick(x => x + 1), 500); return () => clearInterval(h); }, [rec]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Voice recording is not supported in this browser', 'error');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const cur = { stream, mr, chunks: [], transcript: '', started: Date.now(), cancel: false };
      r.current = cur;
      mr.ondataavailable = e => e.data.size && cur.chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        try { cur.sr?.stop(); } catch { /* already stopped */ }
        if (cur.cancel) return;
        const type = mr.mimeType || 'audio/webm';
        const blob = new Blob(cur.chunks, { type });
        const file = new File([blob], `Voice note ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.${type.includes('mp4') ? 'm4a' : 'webm'}`, { type });
        let att;
        try { att = await toAttachment(file, 'voice'); } catch (e) { return toast(e.message, 'error'); }
        setTimeout(() => done.current({ text: cur.transcript.trim(), voice: { duration: Math.max(1, Math.round((Date.now() - cur.started) / 1000)) }, attachments: [att] }), 350);
      };
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const sr = new SR();
        sr.continuous = true; sr.interimResults = true; sr.lang = navigator.language || 'en-US';
        sr.onresult = ev => {
          let t = '';
          for (const res of ev.results) t += res[0].transcript + (res.isFinal ? ' ' : '');
          cur.transcript = t;
          setRec(x => x && { ...x, transcript: t });
        };
        sr.onerror = () => {};
        try { sr.start(); cur.sr = sr; } catch { /* no speech service */ }
      }
      mr.start();
      setRec({ started: cur.started, transcript: '', live: !!SR });
    } catch {
      toast('Microphone permission was denied', 'error');
    }
  };
  const stop = () => { if (r.current.mr?.state === 'recording') r.current.mr.stop(); setRec(null); };
  const cancel = () => { r.current.cancel = true; stop(); };
  return { rec, start, stop, cancel };
}

function Composer({ onSend, files, setFiles, simulate, setSimulate }) {
  const { role, names } = useP();
  const { toast } = useStore();
  const [text, setText] = useState('');
  const fileRef = useRef(), ta = useRef();
  const { rec, start, stop, cancel } = useRecorder(onSend);
  const owner = role === 'owner';

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [text]);

  const submit = () => {
    if (!text.trim() && !files.length) return;
    onSend({ text: text.trim(), attachments: files });
    setText(''); setFiles([]);
  };
  const add = async list => {
    const res = await Promise.allSettled([...list].map(f => toAttachment(f)));
    res.filter(r => r.status === 'rejected').forEach(r => toast(r.reason.message, 'error'));
    setFiles(f => [...f, ...res.filter(r => r.status === 'fulfilled').map(r => r.value)]);
  };

  return (
    <div className="px-3 md:px-8 pb-4 pt-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map(f => (
            <span key={f.id} className="flex items-center gap-2 text-xs bg-[#1f1f1f] ring-1 ring-white/10 rounded-lg pl-2.5 pr-1 py-1">
              <Paperclip size={12} />{f.name}<span className="text-neutral-500">{fmtSize(f.size)}</span>
              <button onClick={() => setFiles(x => x.filter(y => y.id !== f.id))} className="p-0.5 rounded hover:bg-white/10" title="Remove (not sent yet)"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div className={cx('flex items-end gap-1.5 bg-[#1b1b1b] ring-1 rounded-2xl px-2 py-2 transition focus-within:ring-sky-500/60', simulate ? 'ring-amber-500/50' : 'ring-white/10')}>
        <input ref={fileRef} type="file" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
        <Button variant="ghost" size="icon" title="Attach files" onClick={() => fileRef.current.click()}><Paperclip size={18} /></Button>
        {rec ? (
          <div className="flex-1 flex items-center gap-3 px-2 py-1.5 min-w-0">
            <span className="wave flex items-center gap-[3px] text-rose-400 h-5">{[0, 1, 2, 3].map(i => <span key={i} style={{ animationDelay: i * 0.12 + 's' }} />)}</span>
            <span className="text-sm text-rose-300 tabular-nums">{Math.floor((Date.now() - rec.started) / 1000)}s</span>
            <span className="text-sm text-neutral-400 truncate">{rec.transcript || (rec.live ? 'Listening… transcript appears here' : 'Recording… (no live transcript in this browser)')}</span>
          </div>
        ) : (
          <textarea ref={ta} rows={1} value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            onPaste={e => { if (e.clipboardData.files.length) { e.preventDefault(); add(e.clipboardData.files); } }}
            placeholder={simulate ? `Typing as ${names.client} (simulation)…` : 'Write a message — shorthand is fine'}
            className="flex-1 bg-transparent outline-none resize-none py-1.5 px-1 text-[15px] placeholder:text-neutral-600 max-h-44" />
        )}
        {owner && !rec && (
          <Button variant="ghost" size="icon" title={simulate ? 'Stop simulating the client' : `Simulate a message from ${names.client}`} onClick={() => setSimulate(!simulate)} className={simulate ? 'text-amber-300' : ''}><Repeat size={17} /></Button>
        )}
        {rec ? (
          <>
            <Button variant="ghost" size="icon" title="Discard recording" onClick={cancel}><X size={18} /></Button>
            <button onClick={stop} title="Stop and send" className="h-9 w-9 rounded-full grid place-items-center bg-rose-500 text-white" style={{ animation: 'pulse-ring 1.2s infinite' }}><Square size={14} fill="currentColor" /></button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" title="Record a voice note" onClick={start}><Mic size={18} /></Button>
            <button onClick={submit} title="Send" className="h-9 w-9 rounded-full grid place-items-center bg-white text-neutral-900 hover:scale-105 active:scale-95 transition disabled:opacity-30" disabled={!text.trim() && !files.length}><ArrowUp size={18} /></button>
          </>
        )}
      </div>
      {simulate && <div className="text-xs text-amber-300/90 mt-1.5 px-2">Simulating {names.client}: messages you send now are recorded as theirs. Handy for testing — invite the real client from the header.</div>}
    </div>
  );
}

export default function Chat({ focus }) {
  const { p, role, mut } = useP();
  const [files, setFiles] = useState([]);
  const [simulate, setSimulate] = useState(false);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [drag, setDrag] = useState(false);
  const [record, setRecord] = useState(null);
  const { toast } = useStore();
  const end = useRef();
  const owner = role === 'owner';

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [p.messages.length]);
  useEffect(() => {
    if (!focus) return;
    setQ('');
    const h = setTimeout(() => flash('msg-' + focus.id), 120);
    return () => clearTimeout(h);
  }, [focus]);

  const send = payload => mut(x => addMessage(x, { from: owner && simulate ? 'client' : role, ...payload }));

  const bySource = useMemo(() => {
    const map = {};
    const push = (id, v) => {
      const l = (map[id] ||= []);
      if (!l.some(x => x.it.id === v.it.id && x.done === v.done)) l.push(v);
    };
    for (const it of p.items) {
      if (it.sourceMsg && !(it.type === 'file' && it.via === 'upload')) push(it.sourceMsg, { it, done: '' });
      for (const h of it.history) {
        if (!h.msg || h.msg === it.sourceMsg) continue;
        if (h.action === 'status') push(h.msg, { it, done: h.to.replace('_', ' ') });
        else if (h.action === 'edit') push(h.msg, { it, done: 'updated' });
        else if (h.action === 'note') push(h.msg, { it, done: 'note' });
      }
    }
    return map;
  }, [p.items]);
  const secrets = useMemo(() => secretValues(p), [p]);

  const ql = q.trim().toLowerCase();
  const list = ql ? p.messages.filter(m => (m.text || '').toLowerCase().includes(ql) || m.attachments.some(a => a.name.toLowerCase().includes(ql))) : p.messages;
  let lastDay = '';
  const pendingCount = p.suggestions.filter(s => s.state === 'pending').length;

  return (
    <div className="flex-1 min-w-0 flex flex-col relative"
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={async e => { e.preventDefault(); setDrag(false); const res = await Promise.allSettled([...e.dataTransfer.files].map(f => toAttachment(f))); res.filter(r => r.status === 'rejected').forEach(r => toast(r.reason.message, 'error')); setFiles(f => [...f, ...res.filter(r => r.status === 'fulfilled').map(r => r.value)]); }}>
      {drag && <div className="absolute inset-3 z-10 rounded-2xl border-2 border-dashed border-sky-400/70 bg-sky-500/10 grid place-items-center text-sky-200 pointer-events-none">Drop files to attach</div>}

      <div className="flex items-center gap-2 px-4 md:px-8 pt-3">
        {searching ? (
          <div className="flex-1 flex items-center gap-2 bg-[#1b1b1b] ring-1 ring-white/10 rounded-xl px-3 py-1.5 anim-fade">
            <Search size={15} className="text-neutral-500" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search this conversation" className="flex-1 bg-transparent outline-none text-sm" />
            {q && <span className="text-xs text-neutral-500">{list.length} found</span>}
            <button onClick={() => { setSearching(false); setQ(''); }} className="text-neutral-500 hover:text-white"><X size={15} /></button>
          </div>
        ) : (
          <>
            <div className="flex-1 text-xs text-neutral-500">{p.messages.length} messages · full history, nothing is ever deleted</div>
            {owner && pendingCount > 0 && <Badge tone="sky" className="xl:hidden"><Sparkles size={11} />{pendingCount} to review</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setSearching(true)}><Search size={14} />Search</Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto px-2 md:px-6 py-4 space-y-1">
        {!list.length && (ql
          ? <Empty icon={Search} title="No messages match" text={`Nothing in this chat contains “${q}”.`} />
          : <Empty icon={Plus} title="Start the conversation" text="Every message is kept forever. The project brain reads it and proposes tasks, requirements, decisions and sensitive details." />)}
        {list.map(m => {
          const day = fmtDay(m.ts);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.id}>
              {sep && <div className="flex items-center gap-3 py-3 px-2"><div className="h-px flex-1 bg-white/5" /><span className="text-[11px] uppercase tracking-wide text-neutral-500">{day}</span><div className="h-px flex-1 bg-white/5" /></div>}
              <Message m={m} secrets={secrets} linked={bySource[m.id] || []} onRecord={(type, msg) => setRecord({ type, msg })} />
            </Fragment>
          );
        })}
        <div ref={end} />
      </div>

      <Composer onSend={send} files={files} setFiles={setFiles} simulate={simulate} setSimulate={setSimulate} />
      {record && <ItemFormModal type={record.type} sourceMsg={record.msg.id} initial={{ title: cleanTitle(record.msg.text || record.msg.attachments[0]?.name || '') }} onClose={() => setRecord(null)} />}
    </div>
  );
}
