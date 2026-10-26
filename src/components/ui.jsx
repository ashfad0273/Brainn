import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Eye, EyeOff, Copy } from 'lucide-react';
import { cx, copyText } from '../lib/util';
import { COLOR, STATUS, TYPES } from '../lib/meta';
import { useStore } from '../store';

/* ---------- project context (shared by owner + client views) ---------- */
export const PCtx = createContext(null);
export const useP = () => useContext(PCtx);

/* ---------- primitives ---------- */
const V = {
  primary: 'bg-white text-neutral-900 hover:bg-neutral-200',
  accent: 'bg-sky-600 text-white hover:bg-sky-500',
  default: 'bg-white/[.04] text-neutral-200 ring-1 ring-inset ring-white/10 hover:bg-white/[.08]',
  ghost: 'text-neutral-300 hover:bg-white/[.06] hover:text-white',
  danger: 'bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/25 hover:bg-rose-500/20',
};
const SZ = { xs: 'h-6 px-2 text-xs gap-1', sm: 'h-7 px-2.5 text-xs gap-1.5', md: 'h-9 px-3.5 text-sm gap-2', icon: 'h-8 w-8 justify-center', iconSm: 'h-7 w-7 justify-center' };
export function Button({ variant = 'default', size = 'md', className, ...p }) {
  return <button type="button" {...p} className={cx('inline-flex items-center rounded-lg font-medium transition active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap', V[variant], SZ[size], className)} />;
}

export function useEsc(fn) {
  useEffect(() => {
    const f = e => e.key === 'Escape' && fn?.();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [fn]);
}

export function Modal({ title, onClose, children, wide, footer, sub }) {
  useEsc(onClose);
  // portalled, so a modal opened from inside a drawer still covers the whole screen
  return createPortal(
    <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm grid place-items-center p-4 anim-fade" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={cx('anim-pop w-full bg-[#1a1a1a] ring-1 ring-white/10 rounded-2xl shadow-2xl max-h-[90vh] flex flex-col', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="flex-1 min-w-0"><h3 className="text-lg font-semibold">{title}</h3>{sub && <p className="text-sm text-neutral-500 mt-0.5">{sub}</p>}</div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X size={18} /></Button>
        </div>
        <div className="px-5 pb-5 overflow-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-white/5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>, document.body);
}

export function Drawer({ onClose, children }) {
  useEsc(onClose);
  return (
    <div className="fixed inset-0 z-30 bg-black/40 anim-fade" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside className="anim-slide absolute right-0 top-0 h-full w-full max-w-xl bg-[#171717] border-l border-white/10 overflow-auto">{children}</aside>
    </div>
  );
}

export const Field = ({ label, hint, children, className }) => (
  <label className={cx('block', className)}>
    <span className="text-xs font-medium text-neutral-400">{label}</span>
    <div className="mt-1">{children}</div>
    {hint && <span className="text-xs text-neutral-500 mt-1 block">{hint}</span>}
  </label>
);
const inp = 'w-full bg-[#111] ring-1 ring-inset ring-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-sky-500/70 transition placeholder:text-neutral-600';
export const Input = ({ className, ...p }) => <input {...p} className={cx(inp, className)} />;
export const Textarea = ({ className, ...p }) => <textarea {...p} className={cx(inp, 'resize-y min-h-[72px]', className)} />;
export const Select = ({ className, children, ...p }) => <select {...p} className={cx(inp, 'pr-8', className)}>{children}</select>;

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-start gap-3 text-left w-full">
      <span className={cx('mt-0.5 w-9 h-5 rounded-full shrink-0 transition relative', checked ? 'bg-sky-500' : 'bg-white/15')}>
        <span className={cx('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      <span><span className="text-sm text-neutral-200">{label}</span>{hint && <span className="block text-xs text-neutral-500 mt-0.5">{hint}</span>}</span>
    </button>
  );
}

export const Badge = ({ tone = 'neutral', children, className, title }) => (
  <span title={title} className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap', COLOR[tone].badge, className)}>{children}</span>
);
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone || 'neutral'}>{STATUS[status]?.label || status}</Badge>;
export function TypeBadge({ type }) {
  const t = TYPES[type], I = t.icon;
  return <Badge tone={t.color}><I size={11} />{t.label}</Badge>;
}
export function TypeIcon({ type, size = 'md' }) {
  const t = TYPES[type], I = t.icon;
  return <span className={cx('rounded-lg grid place-items-center shrink-0', size === 'sm' ? 'w-6 h-6' : 'w-8 h-8', COLOR[t.color].soft, COLOR[t.color].text)}><I size={size === 'sm' ? 13 : 15} /></span>;
}

export const Empty = ({ icon: I, title, text, children }) => (
  <div className="text-center py-14 px-6">
    {I && <div className="mx-auto w-12 h-12 rounded-2xl bg-white/5 grid place-items-center text-neutral-500"><I size={22} /></div>}
    <h3 className="mt-4 font-medium text-neutral-200">{title}</h3>
    {text && <p className="mt-1 text-sm text-neutral-500 max-w-sm mx-auto">{text}</p>}
    {children && <div className="mt-5 flex justify-center gap-2">{children}</div>}
  </div>
);

export function Menu({ trigger, children, align = 'right', up }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return;
    const f = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', f);
    return () => document.removeEventListener('mousedown', f);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(() => setOpen(o => !o), open)}
      {open && (
        <div onClick={() => setOpen(false)} className={cx('absolute z-20 min-w-[210px] rounded-xl bg-[#1d1d1d] ring-1 ring-white/10 shadow-2xl p-1 anim-pop', align === 'right' ? 'right-0' : 'left-0', up ? 'bottom-full mb-2' : 'top-full mt-1')}>
          {children}
        </div>
      )}
    </div>
  );
}
export const MenuItem = ({ icon: I, children, onClick, tone, hint }) => (
  <button type="button" onClick={onClick} className={cx('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left hover:bg-white/[.06]', tone === 'danger' ? 'text-rose-300' : 'text-neutral-200')}>
    {I && <I size={15} className="text-neutral-400 shrink-0" />}
    <span className="flex-1">{children}</span>
    {hint && <span className="text-xs text-neutral-500">{hint}</span>}
  </button>
);

export function Section({ title, count, action, children, className }) {
  return (
    <section className={cx('rounded-2xl bg-[#181818] ring-1 ring-white/[.06]', className)}>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h3 className="text-sm font-semibold text-neutral-200 flex-1">{title}{count != null && <span className="ml-2 text-neutral-500 font-normal">{count}</span>}</h3>
        {action}
      </header>
      <div className="px-1.5 pb-1.5">{children}</div>
    </section>
  );
}

/** A secret value: masked, revealed for 10 seconds on click, copyable. */
export function Secret({ value, className, copy = true }) {
  const [show, setShow] = useState(false);
  const { toast } = useStore();
  useEffect(() => { if (!show) return; const h = setTimeout(() => setShow(false), 10000); return () => clearTimeout(h); }, [show]);
  return (
    <span className={cx('inline-flex items-center gap-1.5 min-w-0', className)}>
      <code className="font-mono text-[13px] truncate">{show ? value : '•'.repeat(Math.min(10, Math.max(6, value.length)))}</code>
      <button type="button" title={show ? 'Hide' : 'Reveal for 10 seconds'} onClick={e => { e.stopPropagation(); setShow(!show); }} className="text-neutral-500 hover:text-white">{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
      {copy && <button type="button" title="Copy" onClick={async e => { e.stopPropagation(); toast((await copyText(value)) ? 'Copied' : 'Copy blocked by the browser'); }} className="text-neutral-500 hover:text-white"><Copy size={14} /></button>}
    </span>
  );
}

export const Spinner = ({ size = 14 }) => <span style={{ width: size, height: size }} className="inline-block rounded-full border-2 border-current border-t-transparent animate-spin" />;
