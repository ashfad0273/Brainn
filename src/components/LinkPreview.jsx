import { useEffect, useRef, useState } from 'react';
import { Maximize2, ExternalLink, X, Globe } from 'lucide-react';
import { api, hasServer } from '../lib/api';
import { useEsc } from './ui';
import { cx } from '../lib/util';

const URL_RE = /\bhttps?:\/\/[^\s<>"'`)\]]+|\bwww\.[^\s<>"'`)\]]+/gi;
/** Unique links in a text, trailing punctuation trimmed. */
export function linksIn(text, max = 2) {
  const out = [];
  for (const raw of String(text || '').match(URL_RE) || []) {
    const u = raw.replace(/[.,!?;:]+$/, '');
    const href = u.startsWith('http') ? u : 'https://' + u;
    if (!out.includes(href)) out.push(href);
    if (out.length >= max) break;
  }
  return out;
}

/** Services that refuse plain framing but have an embed player. → { src, ratio } */
export function embedFor(href) {
  let u;
  try { u = new URL(href); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const seg = u.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com' && (u.searchParams.get('v') || seg[0] === 'shorts' || seg[0] === 'live')) return { src: `https://www.youtube-nocookie.com/embed/${u.searchParams.get('v') || seg[1]}`, ratio: 16 / 9, video: true };
  if (host === 'youtu.be' && seg[0]) return { src: `https://www.youtube-nocookie.com/embed/${seg[0]}`, ratio: 16 / 9, video: true };
  if (host === 'vimeo.com' && /^\d+$/.test(seg[0] || '')) return { src: `https://player.vimeo.com/video/${seg[0]}`, ratio: 16 / 9, video: true };
  if (host === 'loom.com' && seg[0] === 'share' && seg[1]) return { src: `https://www.loom.com/embed/${seg[1]}`, ratio: 16 / 9, video: true };
  if (host === 'figma.com' && ['file', 'design', 'proto', 'board'].includes(seg[0])) return { src: `https://www.figma.com/embed?embed_host=projectbrain&url=${encodeURIComponent(href)}`, ratio: 16 / 10 };
  if (host === 'docs.google.com' && ['document', 'spreadsheets', 'presentation', 'forms'].includes(seg[0]) && seg[1] === 'd') {
    return { src: `https://docs.google.com/${seg[0]}/d/${seg[2]}/${seg[0] === 'forms' ? 'viewform?embedded=true' : 'preview'}`, ratio: seg[0] === 'presentation' ? 16 / 9.5 : 4 / 3 };
  }
  if (host === 'drive.google.com' && seg[0] === 'file' && seg[1] === 'd') return { src: `https://drive.google.com/file/d/${seg[2]}/preview`, ratio: 4 / 3 };
  if (host === 'open.spotify.com' && ['track', 'album', 'playlist', 'episode', 'show'].includes(seg[0])) return { src: `https://open.spotify.com/embed/${seg[0]}/${seg[1]}`, height: seg[0] === 'track' ? 152 : 352 };
  if (host === 'codepen.io' && seg[1] === 'pen') return { src: `https://codepen.io/${seg[0]}/embed/${seg[2]}?default-tab=result`, ratio: 16 / 10 };
  return null;
}

const cache = new Map();
/** Title, image, description and "may it be framed?" for a link, via the server (cached). */
function useUnfurl(href) {
  const [data, setData] = useState(() => cache.get(href) || null);
  useEffect(() => {
    if (!hasServer() || cache.has(href)) { setData(cache.get(href) || null); return; }
    let dead = false;
    const p = cache.get('p:' + href) || api('/v1/unfurl?url=' + encodeURIComponent(href)).catch(() => ({ failed: true }));
    cache.set('p:' + href, p);
    p.then(d => { cache.set(href, d); if (!dead) setData(d); });
    return () => { dead = true; };
  }, [href]);
  return data;
}

/** Shows only once scrolled into view, so a long chat doesn't load every site at once. */
function useVisible() {
  const ref = useRef();
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ref.current) return;
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { setSeen(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen];
}

const SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation';
const sameOrigin = href => { try { return new URL(href).origin === location.origin; } catch { return true; } };

/** A whole web page shrunk to fit the card, like a live thumbnail. */
function ScaledFrame({ src, title }) {
  const box = useRef();
  const [w, setW] = useState(0);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const PAGE_W = 1280, PAGE_H = 800, k = w / PAGE_W;
  return (
    <div ref={box} className="relative overflow-hidden bg-white" style={{ height: Math.round(PAGE_H * k) || 200 }}>
      {w > 0 && <iframe src={src} title={title} sandbox={SANDBOX} referrerPolicy="no-referrer" loading="lazy" tabIndex={-1}
        style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${k})`, transformOrigin: '0 0', pointerEvents: 'none', border: 0 }} />}
    </div>
  );
}

function Expanded({ href, src, title, onClose }) {
  useEsc(onClose);
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col p-2 md:p-6 anim-fade" onClick={onClose}>
      <div className="flex items-center gap-2 text-sm text-neutral-200 pb-2" onClick={e => e.stopPropagation()}>
        <Globe size={15} className="text-neutral-400" /><span className="flex-1 truncate">{title || href}</span>
        <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15"><ExternalLink size={14} />Open</a>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10" aria-label="Close"><X size={18} /></button>
      </div>
      <iframe src={src} title={title || href} sandbox={SANDBOX} referrerPolicy="no-referrer" className="flex-1 w-full rounded-xl bg-white" onClick={e => e.stopPropagation()} />
    </div>
  );
}

/** Compact preview of one link: a live frame where the site allows it, otherwise a card with its title and image. */
export default function LinkPreview({ href, className }) {
  const embed = embedFor(href);
  const meta = useUnfurl(href);
  const [ref, seen] = useVisible();
  const [big, setBig] = useState(false);
  let host = '';
  try { host = new URL(href).hostname.replace(/^www\./, ''); } catch { /* not a URL */ }
  const title = meta?.title || host;
  const frame = embed ? embed.src : meta?.embeddable && !sameOrigin(href) && meta.kind !== 'image' ? href : null;

  const head = (
    <div className="flex items-center gap-2 px-3 py-2 min-w-0">
      {meta?.favicon ? <img src={meta.favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <Globe size={14} className="text-neutral-500 shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-neutral-100 truncate leading-tight">{title}</div>
        <div className="text-[11px] text-neutral-500 truncate">{meta?.siteName && meta.siteName !== title ? meta.siteName : host}</div>
      </div>
      {frame && <button type="button" onClick={() => setBig(true)} title="Open large" className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"><Maximize2 size={14} /></button>}
      <a href={href} target="_blank" rel="noreferrer" title="Open in a new tab" className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10"><ExternalLink size={14} /></a>
    </div>
  );

  return (
    <div ref={ref} className={cx('mt-1.5 w-full max-w-[420px] rounded-xl overflow-hidden bg-[#1b1b1b] ring-1 ring-white/10', className)}>
      {head}
      {seen && (embed
        ? <iframe src={embed.src} title={title} sandbox={SANDBOX} referrerPolicy="no-referrer" loading="lazy" allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            className="w-full block border-0 bg-black" style={embed.height ? { height: embed.height } : { aspectRatio: embed.ratio }} />
        : frame
          ? <button type="button" onClick={() => setBig(true)} className="block w-full text-left" title="Click to interact"><ScaledFrame src={frame} title={title} /></button>
          : meta?.image
            ? <a href={href} target="_blank" rel="noreferrer" className="block"><img src={meta.image} alt="" loading="lazy" className="w-full max-h-52 object-cover bg-black/30" onError={e => { e.currentTarget.style.display = 'none'; }} /></a>
            : null)}
      {!frame && meta?.description && <div className="px-3 pb-2.5 text-xs text-neutral-400 line-clamp-2">{meta.description}</div>}
      {big && <Expanded href={href} src={frame} title={title} onClose={() => setBig(false)} />}
    </div>
  );
}
