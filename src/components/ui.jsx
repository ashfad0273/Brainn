import { createContext, useContext, useEffect, useState } from 'react';
import { Button as UmeButton } from '@ume/ui/components/ui/button';
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter } from '@ume/ui/components/ui/dialog';
import { Sheet, SheetPopup } from '@ume/ui/components/ui/sheet';
import { Menu as UmeMenu, MenuTrigger, MenuPopup, MenuItem as UmeMenuItem } from '@ume/ui/components/ui/menu';
import { Input as UmeInput } from '@ume/ui/components/ui/input';
import { Textarea as UmeTextarea } from '@ume/ui/components/ui/textarea';
import { Switch } from '@ume/ui/components/ui/switch';
import { Badge as UmeBadge } from '@ume/ui/components/ui/badge';
import { Spinner as UmeSpinner } from '@ume/ui/components/ui/spinner';
import { EmptyState } from '@ume/ui/components/patterns/EmptyState';
import { IconChip } from '@ume/ui/components/patterns/IconChip';
import { CountBadge } from '@ume/ui/components/patterns/parts';
import { FormLabel } from '@ume/ui/components/patterns/form';
import { cn } from '@ume/ui/lib/utils';
import { Eye, EyeOff, Copy, ChevronDown } from '@/lib/icons';
import { copyText } from '../lib/util';
import { STATUS, TYPES } from '../lib/meta';
import { useStore } from '../store';

/* Brainn's shared parts, drawn with Ume (withsaber/ume). The props are the ones
   the screens already use; the look, motion and focus come from Ume. */

/* ---------- project context (shared by owner + client views) ---------- */
export const PCtx = createContext(null);
export const useP = () => useContext(PCtx);

/* Brainn tone → Ume hue. */
const HUE = { emerald: 'green', sky: 'sky', violet: 'violet', rose: 'rose', amber: 'amber', orange: 'orange', cyan: 'teal' };

/* ---------- primitives ---------- */
const VARIANT = { primary: 'default', accent: 'brand', default: 'secondary', ghost: 'ghost', danger: 'destructive-soft' };
const SIZE = { xs: 'xs', sm: 'sm', md: 'default', lg: 'lg', icon: 'icon-sm', iconSm: 'icon-xs' };
/* Modal footers use the lg button (Ume rule); a footer sets the default. */
const FooterSize = createContext('md');
export function Button({ variant = 'default', size, ...p }) {
  const fallback = useContext(FooterSize);
  return <UmeButton variant={VARIANT[variant] || variant} size={SIZE[size || fallback] || size} {...p} />;
}

export function useEsc(fn) {
  useEffect(() => {
    const f = e => e.key === 'Escape' && fn?.();
    addEventListener('keydown', f);
    return () => removeEventListener('keydown', f);
  }, [fn]);
}

/* Screens mount a modal to open it and unmount it to close it, so the dialog is
   always open here and any dismissal goes to onClose. */
export function Modal({ title, onClose, children, wide, footer, sub }) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogPopup className={wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}>
        <DialogHeader className="pe-14">
          <DialogTitle>{title}</DialogTitle>
          {sub && <DialogDescription>{sub}</DialogDescription>}
        </DialogHeader>
        <DialogPanel>{children}</DialogPanel>
        {footer && <DialogFooter><FooterSize.Provider value="lg">{footer}</FooterSize.Provider></DialogFooter>}
      </DialogPopup>
    </Dialog>
  );
}

export function Drawer({ onClose, children }) {
  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetPopup side="right" showCloseButton={false} className="max-w-xl">
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </SheetPopup>
    </Sheet>
  );
}

export const Field = ({ label, hint, children, className }) => (
  <label className={cn('block', className)}>
    <FormLabel>{label}</FormLabel>
    {children}
    {hint && <span className="mt-1.5 block px-0.5 text-xs text-muted-foreground">{hint}</span>}
  </label>
);
export const Input = ({ className, ...p }) => <UmeInput nativeInput className={className} {...p} />;
export const Textarea = ({ className, ...p }) => <UmeTextarea className={className} {...p} />;
/* A native select (the screens pass <option>s), dressed as a Ume field. */
export const Select = ({ className, children, ...p }) => (
  <span className={cn('relative inline-flex w-full', className)}>
    <select {...p} className="h-11 w-full appearance-none rounded-xl border border-input bg-card ps-3 pe-9 text-sm text-foreground shadow-xs outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-64">{children}</select>
    <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </span>
);

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex w-full cursor-pointer items-start gap-3 text-left">
      <Switch className="mt-0.5" checked={checked} onCheckedChange={v => onChange(v)} />
      <span><span className="text-sm text-foreground">{label}</span>{hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  );
}

/* Badges are Plex Sans Medium in normal case (standard.md §2, Less mono). */
const badgeSans = 'font-sans font-medium text-xs normal-case tracking-normal';
export const Badge = ({ tone = 'neutral', children, className, title }) => (
  <UmeBadge size="sm" title={title} hue={HUE[tone]} variant={HUE[tone] ? undefined : 'secondary'} className={cn(badgeSans, className)}>{children}</UmeBadge>
);
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone || 'neutral'}>{STATUS[status]?.label || status}</Badge>;
export function TypeBadge({ type }) {
  const t = TYPES[type], I = t.icon;
  return <Badge tone={t.color}><I />{t.label}</Badge>;
}
export function TypeIcon({ type, size = 'md' }) {
  const t = TYPES[type];
  return <IconChip icon={t.icon} hue={HUE[t.color] || 'neutral'} size={size === 'sm' ? 'sm' : 'md'} />;
}

export const Empty = ({ icon, title, text, children }) => (
  <EmptyState icon={icon} title={title} description={text} action={children ? <div className="flex justify-center gap-2">{children}</div> : null} />
);

/* `trigger(toggle, open)` draws the button; Ume's MenuTrigger opens and closes it,
   so the toggle handed to the screen does nothing. */
const noop = () => {};
export function Menu({ trigger, children, align = 'right', up }) {
  const [open, setOpen] = useState(false);
  return (
    <UmeMenu open={open} onOpenChange={setOpen}>
      <MenuTrigger render={trigger(noop, open)} />
      <MenuPopup align={align === 'right' ? 'end' : 'start'} side={up ? 'top' : 'bottom'}>{children}</MenuPopup>
    </UmeMenu>
  );
}
export const MenuItem = ({ icon: I, children, onClick, tone, hint }) => (
  <UmeMenuItem onClick={onClick} variant={tone === 'danger' ? 'destructive' : 'default'}>
    {I && <I />}
    <span className="flex-1">{children}</span>
    {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
  </UmeMenuItem>
);

export function Section({ title, count, action, children, className }) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card shadow-card', className)}>
      <header className="flex items-center gap-2 px-4 pt-3.5 pb-2">
        <h3 className="flex flex-1 items-center gap-2 font-medium text-foreground">{title}{count != null && <CountBadge count={count} />}</h3>
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
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <code className="truncate font-mono text-xs">{show ? value : '•'.repeat(Math.min(10, Math.max(6, value.length)))}</code>
      <button type="button" title={show ? 'Hide' : 'Reveal for 10 seconds'} onClick={e => { e.stopPropagation(); setShow(!show); }} className="text-icon-muted hover:text-icon-secondary">{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
      {copy && <button type="button" title="Copy" onClick={async e => { e.stopPropagation(); toast((await copyText(value)) ? 'Copied' : 'Copy blocked by the browser'); }} className="text-icon-muted hover:text-icon-secondary"><Copy size={14} /></button>}
    </span>
  );
}

export const Spinner = ({ size = 14 }) => <UmeSpinner size={size} />;
