import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Paperclip, Mic, ArrowUp, Square, X, Download, FileText, MoreHorizontal,
  Plus, Copy, Sparkles, ScanText, Check, Reply, Bold, Italic, Strikethrough,
  Link as LinkIcon, ListOrdered, List, Quote, Code, Terminal, Smile, AtSign, Loader2, Hash
} from '@/lib/icons';
import { useStore } from '../store';
import * as kv from '../lib/kv';
import { api, hasServer } from '../lib/api';
import { cleanHtml, getCaret, setCaret, textBeforeCaret, eraseBeforeCaret } from '../lib/rich';
import { MessageSuggestions, SuggestionCard, ReadingNote } from './Suggestions';
import LinkPreview, { linksIn } from './LinkPreview';
import { ChatTimeBar } from './People';
import { useP, Button, Menu, MenuItem, Empty } from './ui';
import { ItemFormModal } from './Items';
import ReadFileModal from './ReadFile';
import { addMessage, secretValues, activeMembers, canReview } from '../lib/model';
import { TYPES, TYPE_ORDER, COLOR, memberRole } from '../lib/meta';
import { toAttachment } from '../lib/files';
import { hasFile, useAttachmentUrl } from '../lib/blobs';
import { readableKind } from '../lib/docread';
import { ImageThumb, useDownload } from './Viewer';
import { cx, fmtTime, fmtDay, fmtSize, flash, flashEl, copyText, hashId } from '../lib/util';
import { cleanTitle } from '../lib/extract';
import { generateText } from '../lib/gemini';

const URL_RE = /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/gi;
const AVATAR = ['bg-orange', 'bg-violet', 'bg-green', 'bg-pink', 'bg-amber', 'bg-teal'];
const NAME_TONE = ['text-orange', 'text-violet', 'text-pos', 'text-pink', 'text-warn-ink', 'text-teal'];
const toneOf = id => parseInt(hashId(id || 'client').slice(0, 4), 36) % AVATAR.length;

function formatInline(text) {
  if (!text) return null;
  const TOKEN_RE = /(```[\s\S]*?```|`[^`\n]+`|\*\*[^*\n]+\*\*|~~[^~\n]+~~|~[^~\n]+~|(?:\b|^)_[^_\n]+_(?:\b|$)|(?:\b|^)\*[^*\n]+\*(?:\b|$)|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b|(?:\B|^)@[a-zA-Z0-9_.-]+|\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    let token = match[0];
    let trailing = '';
    if (/[.,!?;:]$/.test(token) && !token.endsWith('`') && !token.endsWith('*') && !token.endsWith('~') && !token.endsWith(')')) {
      trailing = token.slice(-1);
      token = token.slice(0, -1);
    }
    if (token.startsWith('```') && token.endsWith('```')) {
      const inner = token.slice(3, -3).replace(/^\w+\n/, '');
      parts.push(<pre key={match.index} className="my-1.5 p-2 rounded-lg bg-modal-scrim font-mono text-xs overflow-x-auto text-primary">{inner}</pre>);
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(<code key={match.index} className="px-1.5 py-0.5 rounded bg-modal-scrim font-mono text-[0.88em] text-primary">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index} className="font-medium text-foreground">{token.slice(2, -2)}</strong>);
    } else if ((token.startsWith('~~') && token.endsWith('~~')) || (token.startsWith('~') && token.endsWith('~'))) {
      const sliceLen = token.startsWith('~~') ? 2 : 1;
      parts.push(<del key={match.index} className="opacity-75">{token.slice(sliceLen, -sliceLen)}</del>);
    } else if ((token.startsWith('*') && token.endsWith('*')) || (token.startsWith('_') && token.endsWith('_'))) {
      parts.push(<em key={match.index} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[') && token.includes('](')) {
      const linkMatch = token.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (linkMatch) {
        parts.push(<a key={match.index} href={linkMatch[2]} target="_blank" rel="noreferrer" className="underline decoration-primary underline-offset-2 hover:text-primary break-all">{linkMatch[1]}</a>);
      } else {
        parts.push(token);
      }
    } else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(token)) {
      parts.push(<a key={match.index} href={`mailto:${token}`} className="inline-flex items-center text-pos underline decoration-green-ring underline-offset-2 hover:text-pos font-medium">{token}</a>);
    } else if (token.startsWith('@') && token.length > 1) {
      parts.push(<span key={match.index} className="inline-flex items-center font-medium text-primary bg-primary-soft px-1 py-0.5 rounded text-[0.92em]">@{token.slice(1)}</span>);
    } else if (URL_RE.test(token)) {
      const href = token.startsWith('http') ? token : 'https://' + token;
      parts.push(<a key={match.index} href={href} target="_blank" rel="noreferrer" className="underline decoration-border-strong underline-offset-2 hover:decoration-foreground break-all">{token}</a>);
    } else {
      parts.push(token);
    }
    if (trailing) parts.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length ? parts : text;
}

function htmlToMarkdown(html) {
  if (!html) return '';
  let s = html;
  s = s.replace(/<div><br\s*\/?>\s*<\/div>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/div><div>/gi, '\n');
  s = s.replace(/<div>/gi, '\n').replace(/<\/div>/gi, '');
  s = s.replace(/<p>/gi, '\n').replace(/<\/p>/gi, '\n');
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  s = s.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  s = s.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  s = s.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');
  s = s.replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, '~~$1~~');
  s = s.replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, '~~$1~~');
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```');
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  s = s.replace(/<span[^>]*class="[^"]*mention[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return s.trim();
}

function markdownToHtml(md) {
  if (!md) return '';
  let s = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/```([\s\S]*?)```/g, '<pre class="my-1.5 p-2 rounded-lg bg-modal-scrim font-mono text-xs text-primary">$1</pre>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong class="font-medium text-foreground">$1</strong>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del class="opacity-75">$1</del>');
  s = s.replace(/(?:^|\s)\*([^*\n]+)\*(?:\s|$)/g, ' <em class="italic">$1</em> ');
  s = s.replace(/`([^`\n]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-modal-scrim font-mono text-[0.88em] text-primary">$1</code>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" class="underline decoration-primary text-primary">$1</a>');
  s = s.replace(/\n/g, '<br>');
  return s;
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
          className="inline rounded px-1.5 mx-0.5 bg-neg-soft ring-1 ring-rose-ring font-mono text-[0.9em]">{shown[i] ? x.secret : '••••••'}</button>
      : <Linkified text={text.slice(x.s, x.e)} />;
    if (!x.hl) return <Fragment key={i}>{body}</Fragment>;
    const id = first ? markId : undefined;
    first = false;
    return <mark key={i} id={id} className="hl-mark">{body}</mark>;
  });
}

function VoiceNote({ a }) {
  const { url } = useAttachmentUrl(a);
  return <div className="mt-2">{url ? <audio controls src={url} className="h-10 max-w-full" /> : <span className="text-xs text-muted-foreground">{hasFile(a) ? 'Loading voice note…' : 'Voice note (audio too large to keep in the browser)'}</span>}</div>;
}

function ReadButton({ a, m, read }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(true); }} title={read ? 'Read again with AI' : 'Read this file with AI (text, tables, OCR)'}
        className={cx('shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg ring-1 ring-inset transition', read ? 'ring-green-ring text-pos hover:bg-pos-soft' : 'ring-blue-ring text-primary hover:bg-primary-soft')}>
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
        <ImageThumb a={a} className="block cursor-zoom-in" imgClass="max-h-64 max-w-full rounded-xl ring-1 ring-border" />
        {read}
      </div>
    );
  }
  if (a.kind === 'voice') return <VoiceNote a={a} />;
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl bg-card ring-1 ring-border px-3 py-2 max-w-sm">
      <span className="w-9 h-9 rounded-lg bg-teal-soft text-teal grid place-items-center shrink-0"><FileText size={17} /></span>
      <div className="min-w-0 flex-1"><div className="text-sm truncate text-foreground">{a.name}</div><div className="text-xs text-muted-foreground">{a.category} · {fmtSize(a.size)}</div></div>
      {read}
      {hasFile(a)
        ? <button onClick={() => dl(a)} title="Download" className="text-muted-foreground hover:text-foreground"><Download size={16} /></button>
        : <span className="text-xs text-text-tertiary" title="Only the file details were stored">no copy</span>}
    </div>
  );
}

function Message({ m, secrets, linked, onRecord, onReply, hl, readings, sugg = [] }) {
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
      <div className={cx('w-8 h-8 rounded-lg shrink-0 hidden md:grid place-items-center text-xs font-medium text-foreground', m.from === 'owner' ? 'bg-primary' : AVATAR[tone])}>{(name || '?')[0].toUpperCase()}</div>
      <div className={cx('max-w-[85%] md:max-w-[78%] min-w-0 flex flex-col', mine ? 'items-end' : 'items-start')}>
        <div className="text-xs md:text-xs text-muted-foreground mb-0.5 md:mb-1 px-1">
          {!mine && <span className={cx('font-medium', m.from === 'owner' ? 'text-primary' : NAME_TONE[tone])}>{name}</span>}
          {!mine && member && <span className="text-text-tertiary"> · {memberRole(member)}</span>}
          {mine ? '' : ' · '}{fmtTime(m.ts)}
        </div>

        {/* Quoted Reply if message was a reply to another message */}
        {m.replyTo && (
          <div onClick={() => flash('msg-' + m.replyTo.id)}
            className="mb-1 px-2.5 py-1 rounded-lg bg-modal-scrim border-l-2 border-primary text-xs text-foreground hover:bg-modal-scrim cursor-pointer transition flex items-center gap-1.5 max-w-full">
            <Reply size={11} className="text-primary shrink-0" />
            <span className="font-medium text-primary shrink-0">{m.replyTo.name}:</span>
            <span className="truncate opacity-80">{m.replyTo.text}</span>
          </div>
        )}

        <div className={cx('flex items-center gap-1', mine && 'flex-row-reverse')}>
          {(m.text || m.voice) && (
            <div className={cx('rounded-2xl px-3 py-1.5 md:px-4 md:py-2.5 text-[14.5px] md:text-sm leading-relaxed whitespace-pre-wrap break-words', mine ? 'bg-primary text-primary-foreground rounded-tr-md' : 'bg-muted text-foreground rounded-tl-md')}>
              {m.voice && <div className="text-xs opacity-70 mb-1 flex items-center gap-1"><Mic size={12} />Voice note · {m.voice.duration}s{m.text ? ' · transcript' : ''}</div>}
              {m.text ? <MessageText text={m.text} secrets={secrets} span={hl} markId={'hl-' + m.id} /> : <span className="opacity-60 text-sm">No transcript</span>}
            </div>
          )}
          <button type="button" onClick={() => onReply(m)} title="Reply" className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-field-hover transition">
            <Reply size={14} />
          </button>
          {owner && (
            <Menu align={mine ? 'right' : 'left'} trigger={toggle => (
              <button onClick={toggle} title="More" className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-text-tertiary md:text-muted-foreground hover:text-foreground hover:bg-field-hover transition"><MoreHorizontal size={16} /></button>
            )}>
              <MenuItem icon={Reply} onClick={() => onReply(m)}>Reply</MenuItem>
              <div className="px-2.5 pt-2.5 pb-1.5 text-label-mono text-text-secondary">Record from this message</div>
              {TYPE_ORDER.filter(t => t !== 'file').map(t => <MenuItem key={t} icon={TYPES[t].icon} onClick={() => onRecord(t, m)}>{TYPES[t].label}</MenuItem>)}
              {m.text && <MenuItem icon={Copy} onClick={async () => toast((await copyText(m.text)) ? 'Copied' : 'Copy blocked')}>Copy text</MenuItem>}
            </Menu>
          )}
        </div>
        {m.attachments.map(a => <Attachment key={a.id} a={a} m={m} readings={readings} />)}
        {linksIn(m.text).map(href => <LinkPreview key={href} href={href} className={mine ? 'ml-auto' : ''} />)}
        {owner && linked.length > 0 && (
          <div className={cx('flex flex-wrap gap-1 mt-1.5 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-within:opacity-100', mine && 'justify-end')}>
            {linked.map(({ it, done }, i) => (
              <button key={it.id + done} onClick={() => openItem(it.id)} className={cx('text-xs md:text-xs px-1.5 md:px-2 py-0.5 rounded-md ring-1 ring-inset hover:-translate-y-px transition max-w-full truncate', COLOR[TYPES[it.type].color].badge, i >= 2 && !allLinks && 'hidden md:inline-block')}>
                {done === 'updated' ? '↻ updated' : done === 'note' ? '✎ note' : done ? `✓ ${done}` : TYPES[it.type].label}:{it.title.length > 32 ? it.title.slice(0, 32) + '…' : it.title}
              </button>
            ))}
            {/* phones: only the first two records, the rest on tap */}
            {linked.length > 2 && !allLinks && <button onClick={() => setAllLinks(true)} className="md:hidden text-xs px-1.5 py-0.5 rounded-md bg-field text-muted-foreground">+{linked.length - 2} more</button>}
          </div>
        )}
        <MessageSuggestions list={sugg} mine={mine} />
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
  const { state, toast, user } = useStore();
  const [text, setText] = useState('');
  const [tpl, setTpl] = useState(null); // { q, i } while typing #shortcut
  const [showFormat, setShowFormat] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [aiCustom, setAiCustom] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showRephraseMenu, setShowRephraseMenu] = useState(false);

  const fileRef = useRef(), editorRef = useRef(), syncTimer = useRef(null);
  const { rec, start, stop, cancel } = useRecorder(onSend);

  /* ---- drafts: every keystroke is kept in this browser at once (survives a power cut), and on the
     server shortly after (follows you to your phone). The caret position comes back too. ---- */
  const draftKey = `pb-draft:${user?.id || 'local'}:${p.id}`;
  const lastTs = useRef(0), remoteTimer = useRef(null), remoteBody = useRef(null);
  const pushRemote = (keepalive = false) => {
    clearTimeout(remoteTimer.current);
    const body = remoteBody.current;
    if (!body || !hasServer() || !user) return;
    remoteBody.current = null;
    api(`/v1/drafts/${p.id}`, { method: 'PUT', json: body, keepalive }).catch(() => { remoteBody.current = remoteBody.current || body; });
  };
  const saveDraft = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML, md = htmlToMarkdown(html), ts = Date.now();
    const caret = getCaret(el);
    const d = { html: md.trim() ? html : '', text: md, replyTo, caret: caret ?? md.length, ts };
    lastTs.current = ts;
    try {
      if (md.trim()) localStorage.setItem(draftKey, JSON.stringify(d));
      else localStorage.removeItem(draftKey);
    } catch { /* storage full or blocked */ }
    remoteBody.current = d;
    clearTimeout(remoteTimer.current);
    remoteTimer.current = setTimeout(() => pushRemote(), 700);
  };
  const applyDraft = (d, focus) => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = d.html ? cleanHtml(d.html) : markdownToHtml(d.text || '');
    setText(d.text || htmlToMarkdown(el.innerHTML));
    if (setReplyTo) setReplyTo(d.replyTo || null);
    lastTs.current = Number(d.ts) || 0;
    // put the caret back where it was (on phones only when the box is tapped, so the keyboard doesn't pop up)
    if (focus && !matchMedia('(pointer: coarse)').matches) { el.focus(); setCaret(el, d.caret); }
  };
  const fetchRemote = focus => {
    if (!hasServer() || !user) return;
    api(`/v1/drafts/${p.id}`).then(r => {
      const d = r.draft;
      if (d && (Number(d.ts) || 0) > lastTs.current && !remoteBody.current) applyDraft(d, focus);
    }).catch(() => {});
  };

  // Sync editor innerHTML to text state and persist the draft
  const syncContent = () => {
    const html = editorRef.current?.innerHTML || '';
    const md = htmlToMarkdown(html);
    setText(md);

    // AI shortcut trigger
    if (md === '/' || md.startsWith('/')) setShowAi(true);

    // @mention and #template triggers, from the text right before the caret
    const before = textBeforeCaret();
    const atMatch = before?.text.match(/@([a-zA-Z0-9_\s]{0,24})$/);
    if (atMatch) {
      setMentionQuery(atMatch[1].trim().toLowerCase());
      setShowMention(true);
      setShowEmoji(false);
      setShowAi(false);
    } else {
      setShowMention(false);
      setMentionQuery('');
    }
    const hash = (state.settings.templates || []).length && before?.text.match(/(?:^|\s)#([\w-]{0,30})$/);
    setTpl(hash ? t => ({ q: hash[1].toLowerCase(), i: t?.q === hash[1].toLowerCase() ? t.i : 0 }) : null);

    saveDraft();
  };

  // Restore the draft on mount or project change: this browser's copy at once, the server's if it is newer
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = '';
    setText('');
    lastTs.current = 0;
    remoteBody.current = null;
    try {
      const raw = localStorage.getItem(draftKey) || localStorage.getItem(`brain_draft_${p.id}`);
      const d = raw && JSON.parse(raw);
      if (d?.html || d?.text) applyDraft(d, true);
    } catch { /* unreadable draft */ }
    fetchRemote(true);
    const flush = () => { if (document.visibilityState === 'hidden') pushRemote(true); };
    const back = () => { if (document.visibilityState === 'visible') fetchRemote(false); };
    document.addEventListener('visibilitychange', flush);
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pagehide', flush);
    return () => {
      pushRemote(true); // leaving the project: send what's pending
      document.removeEventListener('visibilitychange', flush);
      document.removeEventListener('visibilitychange', back);
      window.removeEventListener('pagehide', flush);
    };
  }, [p.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const str = sel.toString();
      if (str.trim().length > 1) {
        setSelectedText(str);
        return;
      }
    }
    setSelectedText('');
    setShowRephraseMenu(false);
  };

  const formatDoc = (cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    syncContent();
  };

  const formatLink = () => {
    editorRef.current?.focus();
    const url = prompt('Enter link URL (https://...):');
    if (url) {
      const full = url.startsWith('http') ? url : 'https://' + url;
      document.execCommand('createLink', false, full);
      syncContent();
    }
  };

  const formatCode = isBlock => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textContent = range.toString() || (isBlock ? 'code block' : 'code');
    const el = document.createElement(isBlock ? 'pre' : 'code');
    el.className = isBlock
      ? 'my-1.5 p-2 rounded-lg bg-modal-scrim font-mono text-xs text-primary block'
      : 'px-1.5 py-0.5 rounded bg-modal-scrim font-mono text-[0.88em] text-primary';
    el.textContent = textContent;
    range.deleteContents();
    range.insertNode(el);
    syncContent();
  };

  const insertEmoji = em => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, em);
    setShowEmoji(false);
    syncContent();
  };

  const insertMention = name => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const textNode = range.startContainer;
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const textBefore = textNode.textContent.slice(0, range.startOffset);
        const atIdx = textBefore.lastIndexOf('@');
        if (atIdx >= 0) {
          const before = textNode.textContent.slice(0, atIdx);
          const after = textNode.textContent.slice(range.startOffset);
          textNode.textContent = before + `@${name} ` + after;
          const newOffset = atIdx + name.length + 2;
          const newRange = document.createRange();
          newRange.setStart(textNode, Math.min(newOffset, textNode.textContent.length));
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          document.execCommand('insertText', false, `@${name} `);
        }
      } else {
        document.execCommand('insertText', false, `@${name} `);
      }
    } else {
      document.execCommand('insertText', false, `@${name} `);
    }
    setShowMention(false);
    setMentionQuery('');
    syncContent();
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

      editorRef.current?.focus();
      document.execCommand('insertText', false, res);
      syncContent();
      setSelectedText('');
      setShowRephraseMenu(false);
      toast('Rephrased with AI');
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
      if (editorRef.current) {
        editorRef.current.innerHTML = markdownToHtml(drafted);
        syncContent();
      }
      setShowAi(false);
      setAiCustom('');
      toast('Drafted with AI');
    } catch (err) {
      toast('AI drafting failed: ' + (err.message || 'Check Settings → AI'), 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const submit = () => {
    const html = editorRef.current?.innerHTML || '';
    const md = htmlToMarkdown(html);
    if (!md.trim() && !files.length) return;
    onSend({ text: md.trim(), attachments: files, replyTo });
    if (editorRef.current) editorRef.current.innerHTML = '';
    setText('');
    setFiles([]);
    if (setReplyTo) setReplyTo(null);
    setSelectedText('');
    setShowAi(false);
    setShowEmoji(false);
    setShowMention(false);
    // the draft is sent: clear it here and on the server
    setTpl(null);
    clearTimeout(remoteTimer.current);
    remoteBody.current = null;
    lastTs.current = Date.now();
    try { localStorage.removeItem(draftKey); localStorage.removeItem(`brain_draft_${p.id}`); } catch { /* blocked */ }
    kv.del(`draft:${p.id}`).catch(() => {});
    if (hasServer() && user) api(`/v1/drafts/${p.id}`, { method: 'DELETE' }).catch(() => {});
  };

  const templates = state.settings.templates || [];
  const tplMatches = tpl ? templates.filter(t => t.shortcut.toLowerCase().startsWith(tpl.q) || (tpl.q && t.shortcut.toLowerCase().includes(tpl.q))).slice(0, 8) : [];
  const insertTemplate = t => {
    editorRef.current?.focus();
    eraseBeforeCaret((tpl?.q.length || 0) + 1);
    document.execCommand('insertHTML', false, cleanHtml(t.html || markdownToHtml(t.text || '')) + '&nbsp;');
    setTpl(null);
    syncContent();
  };

  const add = async list => {
    const res = await Promise.allSettled([...list].map(f => toAttachment(f)));
    res.filter(r => r.status === 'rejected').forEach(r => toast(r.reason.message, 'error'));
    setFiles(f => [...f, ...res.filter(r => r.status === 'fulfilled').map(r => r.value)]);
  };

  const members = activeMembers(p);
  const qLower = mentionQuery.toLowerCase();
  const filteredMembers = members.filter(m => (m.name || '').toLowerCase().includes(qLower));
  const showOwner = (names.owner || 'Owner').toLowerCase().includes(qLower);

  return (
    <div className="px-1.5 md:px-8 pt-1.5 md:pt-2 pb-[max(.375rem,env(safe-area-inset-bottom))] md:pb-4 relative">
      {/* Attached Files Badge List */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {files.map(f => (
            <span key={f.id} className="flex items-center gap-2 text-xs bg-card ring-1 ring-border rounded-lg pl-2.5 pr-1 py-1">
              <Paperclip size={12} />{f.name}<span className="text-muted-foreground">{fmtSize(f.size)}</span>
              <button onClick={() => setFiles(x => x.filter(y => y.id !== f.id))} className="p-0.5 rounded hover:bg-field-hover" title="Remove"><X size={12} /></button>
            </span>
          ))}
        </div>
      )}

      {/* Floating Selection AI Rephrase Pill */}
      {selectedText.trim().length > 1 && !rec && (
        <div className="absolute left-4 md:left-10 -top-8 z-20 flex items-center gap-1 bg-muted ring-1 ring-blue-ring rounded-xl px-2 py-1 shadow-xl anim-up">
          <button type="button" onClick={() => setShowRephraseMenu(v => !v)} className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-foreground px-1">
            {aiLoading ? <Loader2 size={13} className="animate-spin text-primary" /> : <Sparkles size={13} className="text-primary" />}
            Rephrase with AI
          </button>
          {showRephraseMenu && (
            <div className="absolute left-0 bottom-full mb-1 w-52 bg-card ring-1 ring-border rounded-xl p-1 shadow-2xl space-y-0.5">
              {REPHRASE_OPTIONS.map(opt => (
                <button key={opt.key} type="button" onClick={() => handleRephrase(opt.key)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-field-hover flex flex-col transition text-xs">
                  <span className="font-medium text-foreground">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Writing Assistant Popover */}
      {showAi && !rec && (
        <div className="absolute left-2 md:left-8 right-2 md:right-8 bottom-full mb-2 z-20 bg-card ring-1 ring-border rounded-2xl p-3 shadow-2xl anim-up max-w-xl">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-medium text-violet flex items-center gap-1.5"><Sparkles size={14} />AI Writing Assistant</span>
            <button onClick={() => setShowAi(false)} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-label-mono text-muted-foreground">Quick Prompts</div>
            <div className="flex flex-wrap gap-1.5">
              {AI_PROMPTS.map(p => (
                <button key={p.label} type="button" disabled={aiLoading} onClick={() => handleAiGenerate(p.prompt)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-field hover:bg-field-hover text-foreground hover:text-foreground ring-1 ring-border transition">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            <input value={aiCustom} onChange={e => setAiCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAiGenerate(aiCustom); }}
              placeholder="Or tell AI what to write… e.g. tell client we deployed the updates"
              className="flex-1 bg-modal-scrim ring-1 ring-border rounded-xl px-3 py-1.5 text-xs text-foreground outline-none focus:ring-ring" />
            <button type="button" disabled={aiLoading || !aiCustom.trim()} onClick={() => handleAiGenerate(aiCustom)}
              className="px-3 py-1.5 rounded-xl bg-violet hover:bg-violet/90 disabled:opacity-40 text-xs text-primary-foreground font-medium flex items-center gap-1 transition">
              {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}Generate
            </button>
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmoji && !rec && (
        <div className="absolute left-4 md:left-14 bottom-full mb-2 z-20 bg-card ring-1 ring-border rounded-2xl p-2.5 shadow-2xl anim-up max-w-xs">
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-border">
            <span className="text-xs font-medium text-muted-foreground">Emojis</span>
            <button onClick={() => setShowEmoji(false)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto pr-1">
            {EMOJIS.map(em => (
              <button key={em} type="button" onClick={() => insertEmoji(em)}
                className="w-8 h-8 rounded-lg hover:bg-field-hover text-base grid place-items-center transition">
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* #template popover */}
      {tpl && tplMatches.length > 0 && !rec && (
        <div className="absolute left-10 md:left-24 bottom-full mb-2 z-20 bg-card ring-1 ring-border rounded-2xl p-2 shadow-2xl anim-up w-80 max-w-[calc(100vw-2rem)]">
          <div className="px-2 py-1 text-label-mono text-muted-foreground flex items-center gap-1"><Hash size={11} />Templates <span className="ml-auto normal-case tracking-normal text-text-tertiary">↑↓ · Enter</span></div>
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {tplMatches.map((t, i) => (
              <button key={t.id} type="button" onMouseDown={e => { e.preventDefault(); insertTemplate(t); }}
                className={cx('w-full text-left px-2.5 py-1.5 rounded-lg text-xs', i === tpl.i % tplMatches.length ? 'bg-field-hover' : 'hover:bg-field-hover')}>
                <div className="font-medium text-primary">#{t.shortcut}</div>
                <div className="text-muted-foreground truncate">{t.text || htmlToMarkdown(t.html)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mention Member Popover */}
      {showMention && !rec && (
        <div className="absolute left-10 md:left-24 bottom-full mb-2 z-20 bg-card ring-1 ring-border rounded-2xl p-2 shadow-2xl anim-up w-56">
          <div className="px-2 py-1 text-label-mono text-muted-foreground flex items-center justify-between">
            <span>Mention Someone</span>
            {mentionQuery && <span className="text-primary text-xs">@{mentionQuery}</span>}
          </div>
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {showOwner && (
              <button type="button" onClick={() => insertMention(names.owner)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-field-hover text-xs text-foreground flex items-center justify-between">
                <span className="font-medium text-primary">@{names.owner}</span>
                <span className="text-xs text-muted-foreground">Owner</span>
              </button>
            )}
            {filteredMembers.map(m => (
              <button key={m.id} type="button" onClick={() => insertMention(m.name)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-field-hover text-xs text-foreground flex items-center justify-between">
                <span>@{m.name}</span>
                <span className="text-xs text-muted-foreground">{memberRole(m)}</span>
              </button>
            ))}
            {!showOwner && !filteredMembers.length && (
              <div className="px-2 py-2 text-xs text-muted-foreground text-center">No member matches "@{mentionQuery}"</div>
            )}
          </div>
        </div>
      )}

      {/* Main Slack-style Composer Box */}
      <div className="bg-card ring-1 ring-border rounded-2xl transition focus-within:ring-ring overflow-hidden">
        {/* Reply Preview Banner */}
        {replyTo && (
          <div className="flex items-center justify-between bg-modal-scrim border-l-2 border-primary px-3 py-1.5 text-xs text-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <Reply size={12} className="text-primary shrink-0" />
              <span className="font-medium text-primary shrink-0">Replying to {replyTo.name}:</span>
              <span className="text-muted-foreground truncate">{replyTo.text}</span>
            </div>
            <button type="button" onClick={() => setReplyTo && setReplyTo(null)} className="p-0.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground shrink-0"><X size={14} /></button>
          </div>
        )}

        {/* Top Slack Formatting Bar (Aa toggle) */}
        {showFormat && !rec && (
          <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-card overflow-x-auto">
            <button type="button" onClick={() => formatDoc('bold')} title="Bold (Ctrl+B)" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><Bold size={14} /></button>
            <button type="button" onClick={() => formatDoc('italic')} title="Italic (Ctrl+I)" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><Italic size={14} /></button>
            <button type="button" onClick={() => formatDoc('strikeThrough')} title="Strikethrough" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><Strikethrough size={14} /></button>
            <div className="h-4 w-px bg-field-hover mx-1" />
            <button type="button" onClick={formatLink} title="Link (Ctrl+K)" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><LinkIcon size={14} /></button>
            <button type="button" onClick={() => formatDoc('insertOrderedList')} title="Numbered list" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><ListOrdered size={14} /></button>
            <button type="button" onClick={() => formatDoc('insertUnorderedList')} title="Bullet list" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><List size={14} /></button>
            <button type="button" onClick={() => formatDoc('formatBlock', 'blockquote')} title="Blockquote" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><Quote size={14} /></button>
            <div className="h-4 w-px bg-field-hover mx-1" />
            <button type="button" onClick={() => formatCode(false)} title="Inline code" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><Code size={14} /></button>
            <button type="button" onClick={() => formatCode(true)} title="Code block" className="p-1.5 rounded hover:bg-field-hover text-muted-foreground hover:text-foreground"><Terminal size={14} /></button>
          </div>
        )}

        {/* Input Area */}
        <div className="px-2 pt-2 pb-1">
          {rec ? (
            <div className="flex items-center gap-3 px-2 py-2 min-w-0">
              <span className="wave flex items-center gap-[3px] text-destructive-foreground h-5">{[0, 1, 2, 3].map(i => <span key={i} style={{ animationDelay: i * 0.12 + 's' }} />)}</span>
              <span className="text-sm text-destructive-foreground tabular-nums">{Math.floor((Date.now() - rec.started) / 1000)}s</span>
              <span className="text-sm text-muted-foreground truncate">{rec.transcript || (rec.live ? 'Listening… transcript appears here' : 'Recording… (no live transcript in this browser)')}</span>
            </div>
          ) : (
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              tabIndex={0}
              onInput={syncContent}
              onSelect={handleSelectionChange}
              onKeyUp={e => { handleSelectionChange(); if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key) || !tpl) syncContent(); }}
              onMouseUp={() => { handleSelectionChange(); saveDraft(); }}
              onKeyDown={e => {
                if (tpl && tplMatches.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
                  e.preventDefault();
                  if (e.key === 'Escape') setTpl(null);
                  else if (e.key === 'ArrowDown') setTpl(t => ({ ...t, i: t.i + 1 }));
                  else if (e.key === 'ArrowUp') setTpl(t => ({ ...t, i: t.i - 1 + tplMatches.length }));
                  else insertTemplate(tplMatches[tpl.i % tplMatches.length]);
                  return;
                }
                if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); formatDoc('bold'); }
                else if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); formatDoc('italic'); }
                else if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); formatLink(); }
                else if (e.key === 'Enter' && !e.shiftKey && !matchMedia('(pointer: coarse)').matches) {
                  e.preventDefault();
                  submit();
                }
              }}
              onPaste={e => {
                if (e.clipboardData.files.length) {
                  e.preventDefault();
                  add(e.clipboardData.files);
                }
              }}
              data-placeholder={aiLoading ? 'AI is drafting message…' : `Message (/ for AI writing, @ to mention${templates.length ? ', # for templates' : ''})`}
              className="w-full bg-transparent outline-none py-1.5 px-2 text-sm text-foreground min-h-[42px] max-h-48 overflow-y-auto leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none focus:outline-none [&_strong]:font-medium [&_strong]:text-foreground [&_em]:italic [&_em]:text-foreground [&_del]:line-through [&_del]:opacity-75 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-modal-scrim [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-primary [&_a]:underline [&_a]:text-primary [&_pre]:p-2 [&_pre]:rounded-lg [&_pre]:bg-modal-scrim [&_pre]:font-mono [&_pre]:text-xs [&_pre]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-foreground"
            />
          )}
        </div>

        {/* Bottom Slack Action Toolbar */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-border">
          <div className="flex items-center gap-0.5">
            <input ref={fileRef} type="file" multiple hidden onChange={e => { add(e.target.files); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current.click()} title="Attach files" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-field-hover transition"><Paperclip size={17} /></button>
            <button type="button" onClick={() => setShowFormat(v => !v)} title="Toggle formatting bar"
              className={cx('px-2 py-1 rounded-lg text-xs font-medium transition', showFormat ? 'bg-primary-soft text-primary ring-1 ring-blue-ring' : 'text-muted-foreground hover:text-foreground hover:bg-field-hover')}>
              Aa
            </button>
            <button type="button" onClick={() => { setShowEmoji(v => !v); setShowMention(false); setShowAi(false); }} title="Add emoji"
              className={cx('p-1.5 rounded-lg transition', showEmoji ? 'bg-warn-soft text-warn-ink' : 'text-muted-foreground hover:text-foreground hover:bg-field-hover')}>
              <Smile size={17} />
            </button>
            <button type="button" onClick={() => { setShowMention(v => !v); setShowEmoji(false); setShowAi(false); setMentionQuery(''); }} title="Mention someone"
              className={cx('p-1.5 rounded-lg transition', showMention ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-field-hover')}>
              <AtSign size={17} />
            </button>
            <button type="button" onClick={() => { setShowAi(v => !v); setShowEmoji(false); setShowMention(false); }} title="AI writing assistant (/)"
              className={cx('p-1.5 rounded-lg transition flex items-center gap-1 text-xs', showAi ? 'bg-violet-soft text-violet ring-1 ring-violet-ring' : 'text-muted-foreground hover:text-violet hover:bg-field-hover')}>
              <Sparkles size={16} />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {rec ? (
              <>
                <Button variant="ghost" size="icon" title="Discard" onClick={cancel}><X size={17} /></Button>
                <button type="button" onClick={stop} title="Stop and send" className="h-8 w-8 rounded-full grid place-items-center bg-rose text-primary-foreground" style={{ animation: 'pulse-ring 1.2s infinite' }}><Square size={13} fill="currentColor" /></button>
              </>
            ) : (
              <>
                {!text.trim() && !files.length && <Button variant="ghost" size="icon" title="Record a voice note" onClick={start}><Mic size={18} /></Button>}
                {(text.trim() || files.length > 0) && (
                  <button type="button" onClick={submit} title="Send message" className="h-8 w-8 rounded-full grid place-items-center bg-btn-primary text-btn-primary-fg hover:scale-105 active:scale-95 transition">
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

  // new messages, and new suggestions under them, scroll into view
  const pendingNow = p.suggestions.filter(s => s.state === 'pending').length;
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [p.messages.length, pendingNow]);
  useEffect(() => {
    if (!focus) return;
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

  // suggestions sit under the message they came from; the rest (assistant, files) at the end
  const review = canReview(role, me);
  const { byMsg, loose } = useMemo(() => {
    const byMsg = {}, loose = [];
    if (!review) return { byMsg, loose };
    const ids = new Set(p.messages.map(m => m.id));
    for (const s of p.suggestions) {
      if (s.state !== 'pending') continue;
      if (s.msg && ids.has(s.msg)) (byMsg[s.msg] ||= []).push(s);
      else loose.push(s);
    }
    return { byMsg, loose };
  }, [p.suggestions, p.messages, review]);

  // Search lives in the project's header; the tab shows how many suggestions wait.
  const list = p.messages;
  let lastDay = '';

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
      {drag && <div className="absolute inset-3 z-10 rounded-2xl border-2 border-dashed border-primary bg-primary-soft grid place-items-center text-primary pointer-events-none">Drop files to attach</div>}

      <div className="flex-1 overflow-auto px-1 md:px-6 py-2 md:py-6 space-y-0.5 md:space-y-1">
        {!list.length && <Empty icon={Plus} title="Start the conversation" text="Every message is kept forever. The project brain reads it and proposes tasks, requirements, decisions and sensitive details." />}
        {list.map(m => {
          const day = fmtDay(m.ts);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.id}>
              {sep && <div className="flex items-center justify-center gap-3 py-2 md:py-3 px-2"><div className="hidden md:block h-px flex-1 bg-field" /><span className="text-label-mono text-muted-foreground md:text-muted-foreground bg-card md:bg-transparent rounded-full px-2.5 py-0.5 md:p-0">{day}</span><div className="hidden md:block h-px flex-1 bg-field" /></div>}
              <Message m={m} secrets={secrets} linked={bySource[m.id] || []} readings={readings} hl={hl?.id === m.id ? hl.span : null} sugg={byMsg[m.id] || []}
                onRecord={(type, msg) => setRecord({ type, msg })}
                onReply={target => setReplyTo({ id: target.id, name: names.msg(target), text: (target.text || target.attachments?.[0]?.name || 'Voice note').slice(0, 140) })} />
            </Fragment>
          );
        })}
        {loose.length > 0 && (
          <div className="max-w-md mx-auto py-3 space-y-1.5">
            <div className="text-xs text-primary flex items-center gap-1.5 px-1"><Sparkles size={11} />{loose.length} more suggestion{loose.length > 1 ? 's' : ''} (from the assistant or files)</div>
            {loose.map(s => <SuggestionCard key={s.id} s={s} />)}
          </div>
        )}
        {review && <ReadingNote />}
        <div ref={end} />
      </div>

      <Composer onSend={send} files={files} setFiles={setFiles} replyTo={replyTo} setReplyTo={setReplyTo} />
      {record && <ItemFormModal type={record.type} sourceMsg={record.msg.id} initial={{ title: cleanTitle(record.msg.text || record.msg.attachments[0]?.name || '') }} onClose={() => setRecord(null)} />}
    </div>
  );
}
