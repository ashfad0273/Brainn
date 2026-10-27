/* The motion scale. One table, used everywhere; mirrored as --duration-* and
   --ease-* in src/index.css so CSS transitions and Motion's JS animations read
   the same numbers.

   | token   | value  | used for                                              |
   | ------- | ------ | ----------------------------------------------------- |
   | instant | 0      | reduced motion, chart tooltips, live value updates    |
   | fast    | 120ms  | colour, press, and every exit (hover is instant)      |
   | base    | 180ms  | menus, popovers, tooltips, page enter, toasts, badges |
   | slow    | 280ms  | dialogs (scale 0.96, no blur), sheets, drawers        |
   | chart   | 400ms  | chart reveals (the ceiling, with no begin delay)      |
   | ticker  | 350ms  | number tickers                                        |

   Nothing in the interface runs longer than `slow`; charts may take up to
   `chart`. scripts/check-conventions.mjs (`slow-duration`) fails the build on
   any duration or delay over `slow` (280ms) outside the chart files. */

/** Durations in seconds, Motion's unit. */
export const DURATION = {
  instant: 0,
  fast: 0.12,
  base: 0.18,
  slow: 0.28,
  chart: 0.4,
  ticker: 0.35,
} as const;

/** The same durations in milliseconds, for CSS, Recharts and timers. */
export const DURATION_MS = {
  instant: 0,
  fast: 120,
  base: 180,
  slow: 280,
  chart: 400,
  ticker: 350,
} as const;

/** The one ease-out. Everything that is not a spring or an edge panel uses it. */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/** CSS string form of EASE_OUT for inline style transitions. */
export const EASE_OUT_CSS = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Edge panels only (sheets and drawers): iOS's sheet curve. */
export const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** CSS string form of EASE_DRAWER. */
export const EASE_DRAWER_CSS = "cubic-bezier(0.32, 0.72, 0, 1)";

/** The one spring: shared-layout pills and indicators, switch thumbs, morphs
 * and content swaps. `visualDuration` makes it settle visually in 200ms
 * whatever the distance travelled, and `bounce: 0` means it never overshoots. */
export const SPRING = {
  type: "spring",
  visualDuration: 0.2,
  bounce: 0,
} as const;

/** Press feedback: the scale and the spring it travels on. 0.97 is felt but
 * not seen (below 0.95 people notice the effect instead of the click), and
 * it settles in `fast` (about 120ms) so the button keeps up with the finger.
 * A spring rather than a tween, so a quick re-press turns around with its
 * speed. Larger tappable surfaces (rows, cards) press to PRESS_SCALE_SURFACE:
 * the same scale moves their edges further. check-conventions `press-scale`
 * holds both. */
export const PRESS_SCALE = 0.97;

/** Press scale for a large tappable surface: a row, a card, a tile. */
export const PRESS_SCALE_SURFACE = 0.99;

export const SPRING_PRESS = {
  type: "spring",
  visualDuration: DURATION.fast,
  bounce: 0,
} as const;

/** Tooltips: the first one waits this long, so passing over a toolbar on the
 * way to something else shows nothing; once one is open its neighbours open
 * at once (TooltipProvider). The one delay over `slow`, by design: a
 * deliberate wait, not a motion. */
export const TOOLTIP_DELAY_MS = 500; // allow-slow-duration: the tooltip's intent delay, not a motion

/** List entrances: 20ms between items, and never more than 100ms in total, so
 * a long list arrives as fast as a short one. */
export const STAGGER = {
  step: 0.02,
  max: 0.1,
} as const;

/** Delay for item `index` of `count` under the STAGGER cap, in seconds. */
export function staggerDelay(index: number, count: number): number {
  const step = Math.min(STAGGER.step, STAGGER.max / Math.max(1, count - 1));
  return Math.min(index, count - 1) * step;
}

/** @deprecated Use SPRING. Kept so older call sites resolve to the one spring. */
export const SPRING_SWAP = SPRING;

/** @deprecated Use SPRING. Kept so older call sites resolve to the one spring. */
export const SPRING_PANEL = SPRING;

/** @deprecated Use SPRING. Kept so older call sites resolve to the one spring. */
export const SPRING_LAYOUT = SPRING;

/** Dragged handles and fills (sliders) — critically damped `useSpring` config,
 * so the value follows the pointer and never rebounds off an end. Pointer
 * physics rather than a transition, so it sits outside the scale above. */
export const SPRING_GLIDE = {
  stiffness: 700,
  damping: 50,
  mass: 0.5,
} as const;
