import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Paperclip, Mic, ArrowUp, Square, X, Download, FileText, Search, MoreHorizontal,
  Plus, Copy, Sparkles, ScanText, Check, Reply, Bold, Italic, Strikethrough,
  Link as LinkIcon, ListOrdered, List, Quote, Code, Terminal, Smile, AtSign, Loader2
} from 'lucide-react';
import { useStore } from '../store';
import { useP, Button, Menu, MenuItem, Badge, Empty } from './ui';
import { ItemFormModal } from './Items';
import ReadFileModal from './ReadFile';
import { addMessage, secretValues, activeMembers } from '../lib/model';
import { TYPES, TYPE_ORDER, COLOR, memberRole } from '../lib/meta';
import { toAttachment } from '../lib/files';
import { hasFile, useAttachmentUrl } from '../lib/blobs';
import { readableKind } from '../lib/docread';
import { ImageThumb, useDownload } from './Viewer';
import { cx, fmtTime, fmtDay, fmtSize, flash, flashEl, copyText, hashId } from '../lib/util';
import { cleanTitle } from '../lib/extract';
import { generateText } from '../lib/gemini';

const URL_RE = /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/gi;
const AVATAR = ['bg-orange-600', 'bg-violet-600', 'bg-emerald-600', 'bg-pink-600', 'bg-amber-600', 'bg-teal-600'];
const NAME_TONE = ['text-orange-300', 'text-violet-300', 'text-emerald-300', 'text-pink-300', 'text-amber-300', 'text-teal-300'];
const toneOf = id => parseInt(hashId(id || 'client').slice(0, 4), 36) % AVATAR.length;

function formatInline(text) {
  if (!text) return null;
  const TOKEN_RE = /(```[\s\S]*?```|`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|~[^~\n]+~|(?:\b|^)_[^_\n]+_(?:\b|$)|(?:\b|^)\*[^*\n]+\*(?:\b|$)|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('```') && token.endsWith('```')) {
      const inner = token.slice(3, -3).replace(/^\w+\n/, '');
      parts.push(<pre key={match.index} className="my-1.5 p-2 rounded-lg bg-black/40 font-mono text-[13px] overflow-x-auto text-sky-200">{inner}</pre>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="px-1.5 py-0.5 rounded bg-black/40 font-mono text-[0.88em] text-sky-300">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else if ((token.startsWith('~~') && token.endsWith('~~')) || (token.startsWith('~') && token.endsWith('~'))) {
      const sliceLen = token.startsWith('~~') ? 2 : 1;
      parts.push(<del key={match.index} className="opacity-75">{token.slice(sliceLen, -sliceLen)}</del>);
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      parts.push(<em key={match.index} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        parts.push(<a key={match.index} href={linkMatch[2]} target="_blank" rel="noreferrer" className="underline decoration-sky-400 underline-offset-2 hover:text-sky-300 break-all">{linkMatch[1]}</a>);
      } else {
        parts.push(token);
      }
    } else if (URL_RE.test(token)) {
      const href = token.startsWith('http') ? token : 'https://' + token;
      parts.push(<a key={match.index} href={href} target="_blank" rel="noreferrer" className="underline decoration-white/40 underline-offset-2 hover:decoration-white break-all">{token}</a>);
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : text;
}

function Linkified({ text }) {
  return <>{formatInline(text)}</>;
}

/**
 * Message text with sensitive values masked (click to reveal) and, when jumping from a record,
 * the exact passage it came from highlighted. Works on character offsets so a mask never splits.
 */
function MessageText({ text, secrets, span, markId }) {
  const [shown, setShown] = useState({});
  const pieces = useMemo(() => {
    const hits = [];
    for (const v of secrets) {
      for (let k = text.indexOf(v); k >= 0; k = text.indexOf(v, k + v.length)) {
        if (!hits.some(h => k < h.e && k + v.length > h.s)) hits.push({ s: k, e: k + v.length, secret: v });
      }
    }
    hits.sort((a, b) => a.s - b.s);
    const out = [];
    let at = 0;
    const plain = (s, e) => {
      // split plain text at the highlight's edges
      const cuts = [s, ...(span ? [span.start, span.end] : []).filter(x => x > s && x < e), e];
      for (let i = 0; i < cuts.length - 1; i++) out.push({ s: cuts[i], e: cuts[i + 1] });
    };
    for (const h of hits) { if (h.s > at) plain(at, h.s); out.push(h); at = h.e; }
    if (at < text.length) plain(at, text.length);
    return out.map(x => ({ ...x, hl: !!span && x.s < span.end && x.e > span.start }));
  }, [text, secrets, span]);
  let first = true;
  return pieces.map((x, i) => {
    const body = x.secret
      ? <button type="button" title={shown[i] ? 'Hide' : 'Sensitive — click to reveal'} onClick={() => setShown(v => ({ ...v, [i]: !v[i] }))}
          className="inline rounded px-1.5 mx-0.5 bg-black/30 ring-1 ring-rose-400/40 font-mono text-[0.9em]">{shown[i] ? x.secret : '••••••'}</button>
      : <Linkified text={text.slice(x.s, x.e)} />;
    if (!x.hl) return <Fragment key={i}>{body}</Fragment>;
    const id = first ? markId : undefined;
    first = false;
    return <mark key={i} id={id} className="hl-mark">{body}</mark>;
  });
}

function VoiceNote({ a }) {
  const { url } = useAttachmentUrl(a);
  return <div className="mt-2">{url ? <audio controls src={url} className="h-10 max-w-full" /> : <span className="text-xs text-neutral-500">{hasFile(a) ? 'Loading voice note…' : 'Voice note (audio too large to keep in the browser)'}</span>}</div>;
}

function ReadButton({ a, m, read }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(true); }} title={read ? 'Read again with AI' : 'Read this file with AI (text, tables, OCR)'}
        className={cx('shrink-0 flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg ring-1 ring-inset transition', read ? 'ring-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10' : 'ring-sky-500/30 text-sky-300 hover:bg-sky-500/10')}>
        {read ? <Check size={12} /> : <ScanText size={12} />}{read ? 'Read' : 'Read with AI'}
      </button>
      {open && <ReadFileModal message={m} attachment={a} onClose={() => setOpen(false)} />}
    </>
  );
}

function Attachment({ a, m, readings }) {
  const { role } = useP();
  const dl = useDownload();
  const canRead = role === 'owner' && hasFile(a) && !!readableKind(a);
  const read = canRead && <ReadButton a={a} m={m} read={readings[a.id]} />;
  if (a.kind === 'image' && hasFile(a)) {
    return (
      <div className="mt-2 flex items-end gap-2">
        <ImageThumb a={a} className="block cursor-zoom-in" imgClass="max-h-64 max-w-full rounded-xl ring-1 ring-white/10" />
        {read}
      </div>
    );
  }
  if (a.kind === 'voice') return <VoiceNote a={a} />;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl bg-[#1d1d1d] ring-1 ring-white/10 px-3 py-2 max-w-sm">
      <span className="w-9 h-9 rounded-lg bg-cyan-500/10 text-cyan-300 grid place-items-center shrink-0"><FileText size={17} /></span>
      <div className="min-w-0 flex-1"><div className="text-sm truncate text-neutral-100">{a.name}</div><div className="text-xs text-neutral-500">{a.category} · {fmtSize(a.size)}</div></div>
      {read}
      {hasFile(a)
        ? <button onClick={() => dl(a)} title="Download" className="text-neutral-400 hover:text-white"><Download size={16} /></button>
        : <span className="text-[10px] text-neutral-600" title="Only the file details were stored">no copy</span>}
    </div>
  );
}

function Message({ m, secrets, linked, onRecord, onReply, hl, readings }) {
  const { role, me, names, openItem } = useP();
  const { toast } = useStore();
  const owner = role === 'owner';
  const mine = owner ? m.from === 'owner' : m.from !== 'owner' && (m.memberId ? m.memberId === me?.id : me?.role === 'client');
  const name = names.msg(m);
  const member = m.memberId && names.member(m.memberId);
  const tone = toneOf(m.memberId);
  const [allLinks, setAllLinks] = useState(false);
  return (
    <div id={'msg-' + m.id} className={cx('group flex gap-2 md:gap-3 px-1 md:px-2 py-0.5 md:py-1 anim-up', mine && 'flex-row-reverse')}>
      <div className={cx('w-8 h-8 rounded-lg shrink-0 hidden md:grid place-items-center text-xs font-semibold text-white', m.from === 'owner' ? 'bg-sky-600' : AVATAR[tone])}>{(name || '?')[0].toUpperCase()}</div>
      <div className={cx('max-w-[85%] md:max-w-[78%] min-w-0 flex flex-col', mine ? 'items-end' : 'items-start')}>
        <div className="text-[10px] md:text-[11px] text-neutral-500 mb-0.5 md:mb-1 px-1">
          {!mine && <span className={cx('font-medium', m.from === 'owner' ? 'text-sky-300' : NAME_TONE[tone])}>{name}</span>}
          {!mine && member && <span className="text-neutral-600"> · {memberRole(member)}</span>}
          {mine ? '' : ' · '}{fmtTime(m.ts)}
        </div>

        {/* Quoted Reply if message was a reply to another message */}
        {m.replyTo && (
          <div onClick={() => flash('msg-' + m.replyTo.id)}
            className="mb-1 px-2.5 py-1 rounded-lg bg-black/40 border-l-2 border-sky-400 text-xs text-neutral-300 hover:bg-black/60 cursor-pointer transition flex items-center gap-1.5 max-w-full">
            <Reply size={11} className="text-sky-400 shrink-0" />
            <span className="font-semibold text-sky-300 shrink-0">{m.replyTo.name}:</span>
            <span className="truncate opacity-80">{m.replyTo.text}</span>
          </div>
        )}

        <div className={cx('flex items-center gap-1', mine && 'flex-row-reverse')}>
          {(m.text || m.voice) && (
            <div className={cx('rounded-2xl px-3 py-1.5 md:px-4 md:py-2.5 text-[14.5px] md:text-[15px] leading-relaxed whitespace-pre-wrap break-words', mine ? 'bg-sky-600 text-white rounded-tr-md' : 'bg-[#242424] text-neutral-100 rounded-tl-md')}>
              {m.voice && <div className="text-xs opacity-70 mb-1 flex items-center gap-1"><Mic size={12} />Voice note · {m.voice.duration}s{m.text ? ' · transcript' : ''}</div>}
              {m.text ? <MessageText text={m.text} secrets={secrets} span={hl} markId={'hl-' + m.id} /> : <span className="opacity-60 text-sm">No transcript</span>}
            </div>
          )}
          <button type="button" onClick={() => onReply(m)} title="Reply" className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition">
            <Reply size={14} />
          </button>
          {owner && (
            <Menu align={mine ? 'right' : 'left'} trigger={toggle => (
              <button onClick={toggle} title="More" className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-neutral-600 md:text-neutral-500 hover:text-white hover:bg-white/5 transition"><MoreHorizontal size={16} /></button>
            )}>
              <MenuItem icon={Reply} onClick={() => onReply(m)}>Reply</MenuItem>
              <div className="px-3 pt-1.5 pb-1 text-[11px] uppercase tracking-wide text-neutral-500">Record from this message</div>
              {TYPE_ORDER.filter(t => t !== 'file').map(t => <MenuItem key={t} icon={TYPES[t].icon} onClick={() => onRecord(t, m)}>{TYPES[t].label}</MenuItem>)}
              {m.text && <MenuItem icon={Copy} onClick={async () => toast((await copyText(m.text)) ? 'Copied' : 'Copy blocked')}>Copy text</MenuItem>}
            </Menu>
          )}
        </div>
        {m.attachments.map(a => <Attachment key={a.id} a={a} m={m} readings={readings} />)}
        {owner && linked.length > 0 && (
          <div className={cx('flex flex-wrap gap-1 mt-1.5', mine && 'justify-end')}>
            {linked.map(({ it, done }, i) => (
              <button key={it.id + done} onClick={() => openItem(it.id)} className={cx('text-[10px] md:text-[11px] px-1.5 md:px-2 py-0.5 rounded-md ring-1 ring-inset hover:-translate-y-px transition max-w-full truncate', COLOR[TYPES[it.type].color].badge, i >= 2 && !allLinks && 'hidden md:inline-block')}>
                {done === 'updated' ? '↻ updated' : done === 'note' ? '✎ note' : done ? `✓ ${done}` : TYPES[it.type].label}:{it.title.length > 32 ? it.title.slice(0, 32) + '…' : it.title}
              </button>
            ))}
            {/* phones: only the first two records, the rest on tap */}
            {linked.length > 2 && !allLinks && <button onClick={() => setAllLinks(true)} className="md:hidden text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-neutral-400">+{linked.length - 2} more</button>}
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

const EMOJIS = [
  '👍', '❤️', '🔥', '🎉', '✨', '🚀', '🙏', '👏', '💯', '👀', '🤝', '⚡', '💡',
  '😊', '😂', '😅', '🤔', '😎', '😇', '🥳', '😴', '😬', '🥺', '🤐', '😍', '🙌',
  '💻', '📱', '⚙️', '📊', '📝', '📁', '🔒', '🔑', '📦', '🎯', '📌', '⏰', '📅',
  '✅', '❌', '⏳', '⚠️', '❓', '❗', '🔗', '📄', '✉️', '📞', '💼', '🎨', '🔍'
];

const AI_PROMPTS = [
  { label: 'Draft project status update', prompt: 'Write a concise, professional project progress update covering what was done and what is next.' },
  { label: 'Ask client for credentials/access', prompt: 'Politely ask the client to share the needed login credentials (username/email and password, login link) so we can proceed with the next steps.' },
  { label: 'Confirm requirements & next steps', prompt: 'Write a clear message confirming the latest requirements discussed and summarizing next milestones.' },
  { label: 'Ask client for review & approval', prompt: 'Politely ask the client to review the latest work and share their approval or feedback.' },
  { label: 'Polite follow-up on feedback', prompt: 'Politely follow up with the client regarding our previous question and pending review.' },
];

const REPHRASE_OPTIONS = [
  { key: 'rephrase', label: 'Rephrase', hint: 'Natural & clear' },
  { key: 'pro', label: 'More professional', hint: 'Polished client tone' },
  { key: 'concise', label: 'Make concise', hint: 'Short & punchy' },
  { key: 'friendly', label: 'Friendly & polite', hint: 'Warm and courteous' },
  { key: 'grammar', label: 'Fix grammar & tone', hint: 'Clean & error-free' },
];

function Composer({ onSend, files, setFiles, replyTo, setReplyTo }) {
  const { p, role, names } = useP();
  const { state, toast } = useStore();
  const [text, setText] = useState('');
  const [showFormat, setShowFormat] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiCustom, setAiCustom] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [showRephraseMenu, setShowRephraseMenu] = useState(false);

  const fileRef = useRef(), ta = useRef();
  const { rec, start, stop, cancel } = useRecorder(onSend);

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, [text]);

  const insertTextAtCursor = insert => {
    const el = ta.current;
    if (!el) { setText(t => t + insert); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const next = val.substring(0, start) + insert + val.substring(end);
    setText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    }, 0);
  };

  const wrapSelection = (prefix, suffix = prefix, placeholder = 'text') => {
    const el = ta.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const sel = val.substring(start, end) || placeholder;
    const next = val.substring(0, start) + prefix + sel + suffix + val.substring(end);
    setText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + sel.length);
    }, 0);
  };

  const prefixLines = pfx => {
    const el = ta.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = val.indexOf('\n', end);
    const actualEnd = lineEnd === -1 ? val.length : lineEnd;
    const lines = val.substring(lineStart, actualEnd).split('\n');
    const prefixed = lines.map((l, i) => (typeof pfx === 'function' ? pfx(i) : pfx) + l).join('\n');
    const next = val.substring(0, lineStart) + prefixed + val.substring(actualEnd);
    setText(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + prefixed.length);
    }, 0);
  };

  const handleSelect = () => {
    const el = ta.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (end > start) {
      setSelectedText(el.value.substring(start, end));
      setSelectionRange({ start, end });
    } else {
      setSelectedText('');
      setShowRephraseMenu(false);
    }
  };

  const handleRephrase = async style => {
    if (!selectedText.trim()) return;
    setAiLoading(true);
    try {
      let instruction = 'Rephrase this clearly, naturally, and professionally:';
      if (style === 'pro') instruction = 'Make this more professional, clear, and well-crafted for client communication:';
      else if (style === 'concise') instruction = 'Make this concise, punchy, and to-the-point while keeping all key details:';
      else if (style === 'friendly') instruction = 'Make this warmer, friendlier, and more polite:';
      else if (style === 'grammar') instruction = 'Fix any spelling, grammar, punctuation, and tone issues in this text:';

      const prompt = `${instruction}\n\n"${selectedText}"\n\nReturn ONLY the rephrased text with no quotation marks or meta commentary.`;
      const res = await generateText(state.settings, prompt);
      if (!res) throw new Error('Empty response');

      const el = ta.current;
      const start = selectionRange.start;
      const end = selectionRange.end;
      const next = text.substring(0, start) + res + text.substring(end);
      setText(next);
      setSelectedText('');
      setShowRephraseMenu(false);
      toast('Rephrased with AI');
      setTimeout(() => {
        el?.focus();
        el?.setSelectionRange(start, start + res.length);
      }, 0);
    } catch (err) {
      toast('AI rephrase failed: ' + (err.message || 'Check Settings → AI'), 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiGenerate = async instruction => {
    if (!instruction?.trim()) return;
    setAiLoading(true);
    try {
      const recent = (p.messages || []).slice(-6).map(m => `${names.msg(m)}: ${m.text || ''}`).join('\n');
      const prompt = `You are helping the ${role === 'owner' ? 'freelancer/developer' : 'client'} write a chat message for project "${p.name}".
Conversation context:
${recent || 'Start of conversation.'}

Instruction: ${instruction}

Write a natural, concise, ready-to-send chat message. Do NOT include greetings like "Dear..." or sign-offs like "Best regards". Keep it conversational for a Slack/chat app. Return ONLY the drafted text.`;

      const drafted = await generateText(state.settings, prompt);
      if (!drafted) throw new Error('Empty response');
      setText(drafted);
      setShowAi(false);
      setAiCustom('');
      toast('Drafted with AI');
      setTimeout(() => ta.current?.focus(), 0);
    } catch (err) {
      toast('AI drafting failed: ' + (err.message || 'Check Settings → AI'), 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const submit = () => {
    if (!text.trim() && !files.length) return;
    onSend({ text: text.trim(), attachments: files, replyTo });
    setText(''); setFiles([]);
    if (setReplyTo) setReplyTo(null);
    setSelectedText('');
    setShowAi(false);
    setShowEmoji(false);
    setShowMention(false);
  };

  const add = async list => {
    const res = await Promise.allSettled([...list].map(f => toAttachment(f)));
    res.filter(r => r.status === 'rejected').forEach(r => toast(r.reason.message, 'error'));
    setFiles(f => [...f, ...res.filter(r => r.status === 'fulfilled').map(r => r.value)]);
  };

  const members = activeMembers(p);

  return (
    <div className="px-1.5 md:px-8 pt-1.5 md:pt-2 pb-[max(.375rem,env(safe-area-inset-bottom))] md:pb-4 relative">
      {/* Attached Files Badge List */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map(f => (
            <span key={f.id} className="flex items-center gap-2 text-xs bg-[#1f1f1f] ring-1 ring-white/10 rounded-lg pl-2.5 pr-1 py-1">
              <Paperclip size={12} />{f.name}<span className="text-neutral-500">{fmtSize(f.size)}</span>
              <button onClick={() => setFiles(x => x.filter(y => y.id !== f.id))} className="p-0.5 rounded hover:bg-white/10" title="Remove"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Floating Selection AI Rephrase Pill */}
      {selectedText.trim().length > 1 && !rec && (
        <div className="absolute left-4 md:left-10 -top-8 z-20 flex items-center gap-1 bg-[#252525] ring-1 ring-sky-500/40 rounded-xl px-2 py-1 shadow-xl anim-up">
          <button type="button" onClick={() => setShowRephraseMenu(v => !v)} className="flex items-center gap-1.5 text-xs text-sky-300 font-medium hover:text-white px-1">
            {aiLoading ? <Loader2 size={13} className="animate-spin text-sky-400" /> : <Sparkles size={13} className="text-sky-400" />}
            Rephrase with AI
          </button>
          {showRephraseMenu && (
            <div className="absolute left-0 bottom-full mb-1 w-52 bg-[#1e1e1e] ring-1 ring-white/15 rounded-xl p-1 shadow-2xl space-y-0.5">
              {REPHRASE_OPTIONS.map(opt => (
                <button key={opt.key} type="button" onClick={() => handleRephrase(opt.key)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex flex-col transition text-xs">
                  <span className="font-medium text-neutral-200">{opt.label}</span>
                  <span className="text-[10px] text-neutral-400">{opt.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Writing Assistant Popover */}
      {showAi && !rec && (
        <div className="absolute left-2 md:left-8 right-2 md:right-8 bottom-full mb-2 z-20 bg-[#1d1d1d] ring-1 ring-white/15 rounded-2xl p-3 shadow-2xl anim-up max-w-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5"><Sparkles size={14} />AI Writing Assistant</span>
            <button onClick={() => setShowAi(false)} className="text-neutral-500 hover:text-white"><X size={14} /></button>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-[11px] text-neutral-500 font-medium uppercase tracking-wider">Quick Prompts</div>
            <div className="flex flex-wrap gap-1.5">
              {AI_PROMPTS.map(p => (
                <button key={p.label} type="button" disabled={aiLoading} onClick={() => handleAiGenerate(p.prompt)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white ring-1 ring-white/10 transition">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            <input value={aiCustom} onChange={e => setAiCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAiGenerate(aiCustom); }}
              placeholder="Or tell AI what to write… e.g. tell client we deployed the updates"
              className="flex-1 bg-black/40 ring-1 ring-white/10 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:ring-purple-400/50" />
            <button type="button" disabled={aiLoading || !aiCustom.trim()} onClick={() => handleAiGenerate(aiCustom)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs text-white font-medium flex items-center gap-1 transition">
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Generate
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmoji && !rec && (
        <div className="absolute left-4 md:left-14 bottom-full mb-2 z-20 bg-[#1e1e1e] ring-1 ring-white/15 rounded-2xl p-2.5 shadow-2xl anim-up max-w-xs">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5">
            <span className="text-xs font-medium text-neutral-400">Emojis</span>
            <button onClick={() => setShowEmoji(false)} className="text-neutral-500 hover:text-white"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto pr-1">
            {EMOJIS.map(em => (
              <button key={em} type="button" onClick={() => { insertTextAtCursor(em); setShowEmoji(false); }}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-base grid place-items-center transition">
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mention Member Popover */}
      {showMention && !rec && (
        <div className="absolute left-10 md:left-24 bottom-full mb-2 z-20 bg-[#1e1e1e] ring-1 ring-white/15 rounded-2xl p-2 shadow-2xl anim-up w-56">
          <div className="px-2 py-1 text-[11px] font-medium text-neutral-500 uppercase tracking-wider">Mention Someone</div>
          <div className="space-y-0.5">
            <button type="button" onClick={() => { insertTextAtCursor(`@${names.owner} `); setShowMention(false); }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs text-neutral-200 flex items-center justify-between">
              <span>{names.owner}</span>
              <span className="text-[10px] text-neutral-500">Owner</span>
            </button>
            {members.map(m => (
              <button key={m.id} type="button" onClick={() => { insertTextAtCursor(`@${m.name} `); setShowMention(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 text-xs text-neutral-200 flex items-center justify-between">
                <span>{m.name}</span>
                <span className="text-[10px] text-neutral-500">{memberRole(m)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Slack-style Composer Box */}
      <div className="bg-[#1b1b1b] ring-1 ring-white/10 rounded-2xl transition focus-within:ring-sky-500/60 overflow-hidden">
        {/* Reply Preview Banner */}
        {replyTo && (
          <div className="flex items-center justify-between bg-black/40 border-l-2 border-sky-400 px-3 py-1.5 text-xs text-neutral-300">
            <div className="flex items-center gap-2 min-w-0">
              <Reply size={12} className="text-sky-400 shrink-0" />
              <span className="font-semibold text-sky-300 shrink-0">Replying to {replyTo.name}:</span>
              <span className="text-neutral-400 truncate">{replyTo.text}</span>
            </div>
            <button type="button" onClick={() => setReplyTo && setReplyTo(null)} className="p-0.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white shrink-0"><X size={14} /></button>
          </div>
        )}

        {/* Top Slack Formatting Bar (Aa toggle) */}
        {showFormat && !rec && (
          <div className="flex items-center gap-0.5 px-2 py-1 border-b border-white/5 bg-[#171717] overflow-x-auto">
            <button type="button" onClick={() => wrapSelection('**', '**', 'bold text')} title="Bold (Ctrl+B)" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><Bold size={14} /></button>
            <button type="button" onClick={() => wrapSelection('*', '*', 'italic text')} title="Italic (Ctrl+I)" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><Italic size={14} /></button>
            <button type="button" onClick={() => wrapSelection('~~', '~~', 'strikethrough')} title="Strikethrough" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><Strikethrough size={14} /></button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button type="button" onClick={() => wrapSelection('[', '](https://...)', 'link text')} title="Link" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><LinkIcon size={14} /></button>
            <button type="button" onClick={() => prefixLines(i => `${i + 1}. `)} title="Numbered list" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><ListOrdered size={14} /></button>
            <button type="button" onClick={() => prefixLines('- ')} title="Bullet list" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><List size={14} /></button>
            <button type="button" onClick={() => prefixLines('> ')} title="Blockquote" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><Quote size={14} /></button>
            <div className="h-4 w-px bg-white/10 mx-1" />
            <button type="button" onClick={() => wrapSelection('`', '`', 'code')} title="Inline code" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><Code size={14} /></button>
            <button type="button" onClick={() => wrapSelection('```\n', '\n```', 'code block')} title="Code block" className="p-1.5 rounded hover:bg-white/10 text-neutral-400 hover:text-white"><Terminal size={14} /></button>
          </div>
        )}

        {/* Input Area */}
        <div className="px-2 pt-2 pb-1">
          {rec ? (
            <div className="flex items-center gap-3 px-2 py-2 min-w-0">
              <span className="wave flex items-center gap-[3px] text-rose-400 h-5">{[0, 1, 2, 3].map(i => <span key={i} style={{ animationDelay: i * 0.12 + 's' }} />)}</span>
              <span className="text-sm text-rose-300 tabular-nums">{Math.floor((Date.now() - rec.started) / 1000)}s</span>
              <span className="text-sm text-neutral-400 truncate">{rec.transcript || (rec.live ? 'Listening… transcript appears here' : 'Recording… (no live transcript in this browser)')}</span>
            </div>
          ) : (
            <textarea ref={ta} rows={1} value={text}
              onChange={e => {
                const val = e.target.value;
                setText(val);
                if (val === '/' || val.startsWith('/')) setShowAi(true);
              }}
              onSelect={handleSelect}
              onKeyUp={handleSelect}
              onMouseUp={handleSelect}
              onKeyDown={e => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); wrapSelection('**', '**', 'bold text'); }
                else if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); wrapSelection('*', '*', 'italic text'); }
                else if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); wrapSelection('[', '](https://...)', 'link text'); }
                else if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) { e.preventDefault(); submit(); }
              }}
              onPaste={e => { if (e.clipboardData.files.length) { e.preventDefault(); add(e.clipboardData.files); } }}
              placeholder={aiLoading ? 'AI is drafting message…' : 'Message (type / for AI writing assistant)'}
              className="w-full bg-transparent outline-none resize-none py-1 px-1.5 text-[15px] placeholder:text-neutral-500 max-h-44" />
          )}
        </div>

        {/* Bottom Slack Action Toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-white/[.04]">
          <div className="flex items-center gap-0.5">
            <input ref={fileRef} type="file" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current.click()} title="Attach files" className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition"><Paperclip size={17} /></button>
            <button type="button" onClick={() => setShowFormat(v => !v)} title="Toggle formatting bar"
              className={cx('px-2 py-1 rounded-lg text-xs font-semibold transition', showFormat ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30' : 'text-neutral-400 hover:text-white hover:bg-white/10')}>
              Aa
            </button>
            <button type="button" onClick={() => { setShowEmoji(v => !v); setShowMention(false); setShowAi(false); }} title="Add emoji"
              className={cx('p-1.5 rounded-lg transition', showEmoji ? 'bg-amber-500/20 text-amber-300' : 'text-neutral-400 hover:text-white hover:bg-white/10')}>
              <Smile size={17} />
            </button>
            <button type="button" onClick={() => { setShowMention(v => !v); setShowEmoji(false); setShowAi(false); }} title="Mention someone"
              className={cx('p-1.5 rounded-lg transition', showMention ? 'bg-sky-500/20 text-sky-300' : 'text-neutral-400 hover:text-white hover:bg-white/10')}>
              <AtSign size={17} />
            </button>
            <button type="button" onClick={() => { setShowAi(v => !v); setShowEmoji(false); setShowMention(false); }} title="AI writing assistant (/)"
              className={cx('p-1.5 rounded-lg transition flex items-center gap-1 text-xs', showAi ? 'bg-purple-500/25 text-purple-300 ring-1 ring-purple-500/40' : 'text-neutral-400 hover:text-purple-300 hover:bg-white/10')}>
              <Sparkles size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {rec ? (
              <>
                <Button variant="ghost" size="icon" title="Discard" onClick={cancel}><X size={17} /></Button>
                <button type="button" onClick={stop} title="Stop and send" className="h-8 w-8 rounded-full grid place-items-center bg-rose-500 text-white" style={{ animation: 'pulse-ring 1.2s infinite' }}><Square size={13} fill="currentColor" /></button>
              </>
            ) : (
              <>
                {!text.trim() && !files.length && <Button variant="ghost" size="icon" title="Record a voice note" onClick={start}><Mic size={18} /></Button>}
                {(text.trim() || files.length > 0) && (
                  <button type="button" onClick={submit} title="Send message" className="h-8 w-8 rounded-full grid place-items-center bg-white text-neutral-900 hover:scale-105 active:scale-95 transition">
                    <ArrowUp size={17} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Chat({ focus }) {
  const { p, role, me, mut, names } = useP();
  const [files, setFiles] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [drag, setDrag] = useState(false);
  const dragCounter = useRef(0);
  const [record, setRecord] = useState(null);
  const [hl, setHl] = useState(null);
  const { toast } = useStore();
  const end = useRef();
  const owner = role === 'owner';

  useEffect(() => {
    const cancelDrag = () => {
      dragCounter.current = 0;
      setDrag(false);
    };
    const onWindowDragLeave = e => {
      if (!e.relatedTarget && (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
        cancelDrag();
      }
    };
    const onKeyDown = e => { if (e.key === 'Escape') cancelDrag(); };
    window.addEventListener('drop', cancelDrag);
    window.addEventListener('dragend', cancelDrag);
    window.addEventListener('dragleave', onWindowDragLeave);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('drop', cancelDrag);
      window.removeEventListener('dragend', cancelDrag);
      window.removeEventListener('dragleave', onWindowDragLeave);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [p.messages.length]);
  useEffect(() => {
    if (!focus) return;
    setQ('');
    setHl(focus.span ? { id: focus.id, span: focus.span } : null);
    const h = setTimeout(() => {
      // a long message: scroll to the highlighted passage itself, not just the message
      if (!(focus.span && flashEl(document.getElementById('hl-' + focus.id)))) flash('msg-' + focus.id);
    }, 140);
    const off = setTimeout(() => setHl(null), 9000);
    return () => { clearTimeout(h); clearTimeout(off); };
  }, [focus]);

  const send = payload => mut(x => {
    addMessage(x, { from: owner ? 'owner' : 'client', memberId: owner ? null : me?.id, ...payload });
  });

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
  const readings = useMemo(() => Object.fromEntries(p.items.filter(i => i.reading && i.file?.attachmentId).map(i => [i.file.attachmentId, true])), [p.items]);
  const secrets = useMemo(() => secretValues(p), [p]);

  const ql = q.trim().toLowerCase();
  const list = ql ? p.messages.filter(m => (m.text || '').toLowerCase().includes(ql) || m.attachments.some(a => a.name.toLowerCase().includes(ql))) : p.messages;
  let lastDay = '';
  const pendingCount = p.suggestions.filter(s => s.state === 'pending').length;

  return (
    <div className="flex-1 min-w-0 flex flex-col relative chat-bg"
      onDragEnter={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          dragCounter.current++;
          setDrag(true);
        }
      }}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDragLeave={e => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          dragCounter.current--;
          if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDrag(false);
          }
        }
      }}
      onDrop={async e => {
        e.preventDefault();
        dragCounter.current = 0;
        setDrag(false);
        const res = await Promise.allSettled([...e.dataTransfer.files].map(f => toAttachment(f)));
        res.filter(r => r.status === 'rejected').forEach(r => toast(r.reason.message, 'error'));
        setFiles(f => [...f, ...res.filter(r => r.status === 'fulfilled').map(r => r.value)]);
      }}>
      {drag && <div className="absolute inset-3 z-10 rounded-2xl border-2 border-dashed border-sky-400/70 bg-sky-500/10 grid place-items-center text-sky-200 pointer-events-none">Drop files to attach</div>}

      <div className={cx('items-center gap-2 px-3 md:px-8 pt-2 md:pt-3', searching ? 'flex' : 'hidden md:flex')}>
        {searching ? (
          <div className="flex-1 flex items-center gap-2 bg-[#1b1b1b] ring-1 ring-white/10 rounded-xl px-3 py-1.5 anim-fade">
            <Search size={15} className="text-neutral-500" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search this conversation" className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
            {q && <span className="text-xs text-neutral-500">{list.length} found</span>}
            <button onClick={() => { setSearching(false); setQ(''); }} className="text-neutral-500 hover:text-white"><X size={15} /></button>
          </div>
        ) : (
          <>
            <div className="flex-1 text-xs text-neutral-500">{p.messages.length} messages · full history, nothing is ever lost</div>
            {owner && pendingCount > 0 && <Badge tone="sky" className="xl:hidden"><Sparkles size={11} />{pendingCount} to review</Badge>}
            <Button variant="ghost" size="sm" onClick={() => setSearching(true)}><Search size={14} />Search</Button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-auto px-1 md:px-6 py-2 md:py-4 space-y-0.5 md:space-y-1">
        {!list.length && (ql
          ? <Empty icon={Search} title="No messages match" text={`Nothing in this chat contains “${q}”.`} />
          : <Empty icon={Plus} title="Start the conversation" text="Every message is kept forever. The project brain reads it and proposes tasks, requirements, decisions and sensitive details." />)}
        {list.map(m => {
          const day = fmtDay(m.ts);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.id}>
              {sep && <div className="flex items-center justify-center gap-3 py-2 md:py-3 px-2"><div className="hidden md:block h-px flex-1 bg-white/5" /><span className="text-[11px] uppercase tracking-wide text-neutral-400 md:text-neutral-500 bg-[#1d1d1d] md:bg-transparent rounded-full px-2.5 py-0.5 md:p-0">{day}</span><div className="hidden md:block h-px flex-1 bg-white/5" /></div>}
              <Message m={m} secrets={secrets} linked={bySource[m.id] || []} readings={readings} hl={hl?.id === m.id ? hl.span : null}
                onRecord={(type, msg) => setRecord({ type, msg })}
                onReply={target => setReplyTo({ id: target.id, name: names.msg(target), text: (target.text || target.attachments?.[0]?.name || 'Voice note').slice(0, 140) })} />
            </Fragment>
          );
        })}
        <div ref={end} />
      </div>

      <Composer onSend={send} files={files} setFiles={setFiles} replyTo={replyTo} setReplyTo={setReplyTo} />
      {record && <ItemFormModal type={record.type} sourceMsg={record.msg.id} initial={{ title: cleanTitle(record.msg.text || record.msg.attachments[0]?.name || '') }} onClose={() => setRecord(null)} />}
    </div>
  );
}
