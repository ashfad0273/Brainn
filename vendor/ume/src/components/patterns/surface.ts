import { HUE_CLASSES, type Hue } from "../../lib/hue"

/* Shared surface + label styles for dashboard cards (Vibrant, standard.md
   §1–2). In-flow cards are white (light) or grey-900 (dark) on a near-white
   page, with a hairline border and a soft two-layer shadow (`shadow-card`)
   and a 20px radius. Depth comes from card-on-page, not from grey insets.

   The variants cover the reasons a card deviates: less padding, none at all
   because it holds a table or list that manages its own insets, or a hue
   tint for a key card. Reach for one of these rather than writing the
   classes again. */

const surface = "rounded-2xl border border-border bg-card shadow-card"

/** Standard content card: 20px padding. */
export const panel = `${surface} p-5`

/** Denser card — tiles, small stat cards, calendar cells. */
export const panelCompact = `${surface} p-4`

/** Card that holds a table or list supplying its own padding. */
export const panelFlush = `${surface} overflow-hidden`

/** A key card tinted in one hue: soft surface, hue hairline, 20px padding.
    One or two per screen, for the figure the page is about. */
export function panelTint(hue: Hue): string {
  const h = HUE_CLASSES[hue]
  return `rounded-2xl border ${h.ring} ${h.soft} p-5`
}

/** Card title / label: 17px medium foreground, sentence case. Muted is for
    meta only (spec §6), so labels no longer read as pale. */
export const eyebrow = "text-lg font-medium text-foreground"

/** Card heading subtitle: the one muted line, in the uppercase mono Label
    style (`text-label-mono`). */
export const eyebrowSub = "text-label-mono text-muted-foreground"

/* The choice menu (component sheet): the popover behind the Category /
   Person / Added by filters, Assign person and the Year picker. 16px
   corners, 6px inside, rows 9px (rounded-pop-row: 16 − 1 − 6),
   240px at least, as wide as its longest row (up to 300px), and it scrolls
   past min(480px, 70vh). Rows are 40px with 10px padding and gaps. */
export const choiceMenu =
  "min-w-60 max-w-75 origin-(--transform-origin) rounded-pop border border-border-subtle bg-card text-foreground shadow-pop outline-none transition-[scale,opacity] duration-fast ease-out data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0"

/** The scrolling body inside the popup; it carries the 6px inset. */
export const choiceMenuBody = "max-h-[min(var(--menu-max-h),var(--available-height))] overflow-y-auto p-1.5"

/** Menu title in Label Mono: 10px sides, 10px above, 6px below. */
export const choiceMenuTitle = "px-2.5 pt-2.5 pb-1.5 text-label-mono text-text-secondary"

export const choiceMenuRow =
  "group flex h-10 cursor-pointer select-none items-center gap-2.5 rounded-pop-row px-2.5 font-medium text-sm outline-none data-highlighted:bg-input-filled"
