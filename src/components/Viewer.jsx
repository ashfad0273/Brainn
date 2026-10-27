import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useStore } from '../store';
import { useAttachmentUrl, downloadAttachment } from '../lib/blobs';

/** Download button handler that reports failures instead of throwing. */
export function useDownload() {
  const { toast } = useStore();
  return a => downloadAttachment(a).catch(e => toast('Download failed: ' + e.message, 'error'));
}

/** Full-size viewer: original pixels at 100%, wheel/buttons zoom, drag to pan, Esc closes. */
export function Lightbox({ a, onClose }) {
  const { url, failed, retry } = useAttachmentUrl(a);
  const [retried, setRetried] = useState(false);
  const dl = useDownload();
  const [z, setZ] = useState(1), [pos, setPos] = useState({ x: 0, y: 0 }), [bad, setBad] = useState(false);
  const drag = useRef(null);
  const zoom = f => setZ(v => Math.min(16, Math.max(0.05, +(v * f).toFixed(3))));
  const reset = () => { setZ(1); setPos({ x: 0, y: 0 }); };

  const handleImgError = () => {
    if (!retried) {
      setRetried(true);
      retry();
    } else {
      setBad(true);
    }
  };

  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); else if (e.key === '+' || e.key === '=') zoom(1.25); else if (e.key === '-') zoom(0.8); else if (e.key === '0') reset(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const cantShow = failed || bad;
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col anim-fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-200 shrink-0">
        <span className="truncate flex-1" title={a.name}>{a.name}</span>
        <span className="text-xs text-neutral-400 tabular-nums">{Math.round(z * 100)}%</span>
        <button title="Zoom out (-)" onClick={() => zoom(0.8)} className="p-2 rounded-lg hover:bg-white/10"><ZoomOut size={16} /></button>
        <button title="Zoom in (+)" onClick={() => zoom(1.25)} className="p-2 rounded-lg hover:bg-white/10"><ZoomIn size={16} /></button>
        <button title="Actual size, 100% (0)" onClick={reset} className="p-2 rounded-lg hover:bg-white/10"><Maximize2 size={16} /></button>
        <button title="Download original" onClick={() => dl(a)} className="p-2 rounded-lg hover:bg-white/10"><Download size={16} /></button>
        <button title="Close (Esc)" onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X size={18} /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden grid place-items-center select-none"
        style={{ cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onClick={e => e.target === e.currentTarget && onClose()}
        onWheel={e => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)}
        onPointerDown={e => { drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={e => drag.current && setPos({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })}
        onPointerUp={() => { drag.current = null; }}>
        {cantShow ? (
          <div className="text-center text-neutral-300 text-sm space-y-3 p-6">
            <p>This browser can’t display {a.name}{/hei[cf]$/i.test(a.name) ? ' (HEIC)' : ''}.<br />The original file is saved — download it to open it elsewhere.</p>
            <button onClick={() => dl(a)} className="px-3 py-2 rounded-lg bg-white text-neutral-900 inline-flex items-center gap-2"><Download size={14} />Download original</button>
          </div>
        ) : url && (
          <img src={url} alt={a.name} draggable={false} onError={handleImgError}
            style={{ maxWidth: 'none', maxHeight: 'none', transform: `translate(${pos.x}px, ${pos.y}px) scale(${z})`, imageRendering: z > 2 ? 'pixelated' : 'auto' }} />
        )}
      </div>
    </div>, document.body);
}

/** Preview image that opens the Lightbox when clicked. Falls back to a download tile if it can't render. */
export function ImageThumb({ a, className, imgClass }) {
  const { url, failed, retry } = useAttachmentUrl(a);
  const [retried, setRetried] = useState(false);
  const [open, setOpen] = useState(false), [bad, setBad] = useState(false);
  const dl = useDownload();

  const handleImgError = () => {
    if (!retried) {
      setRetried(true);
      retry();
    } else {
      setBad(true);
    }
  };

  if (failed || bad) {
    return <button onClick={() => dl(a)} className={'text-xs text-neutral-300 underline ' + (className || '')} title="Preview not supported in this browser — download the original">{a.name} — can’t preview, download original</button>;
  }
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setOpen(true); }} title="View full size" className={className}>
        {url && <img src={url} alt={a.name} onError={handleImgError} className={imgClass} />}
      </button>
      {open && <Lightbox a={a} onClose={() => setOpen(false)} />}
    </>
  );
}
