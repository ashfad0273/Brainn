/* The Vibrant hue family (src/index.css). Every coloured thing in the app —
   icon chips, avatars, category colours, chart series, badges — takes one of
   these ten names, and reads its four steps through the classes below so
   Tailwind sees each class literally:

   - `solid`: the hue itself, for icons, bars and dots (`text-violet`)
   - `soft`:  the tinted surface (`bg-violet-soft`)
   - `ink`:   text on the soft surface, ≥4.5:1 in both themes
   - `ring`:  a hairline border on the soft surface
   - `fill`:  the hue as a background (bars, dots, swatches) */

export const HUES = [
  "violet",
  "blue",
  "sky",
  "teal",
  "green",
  "lime",
  "amber",
  "orange",
  "rose",
  "pink",
] as const

export type Hue = (typeof HUES)[number]

export interface HueClasses {
  solid: string
  soft: string
  ink: string
  ring: string
  fill: string
}

export const HUE_CLASSES: Record<Hue, HueClasses> = {
  violet: { solid: "text-violet", soft: "bg-violet-soft", ink: "text-violet-ink", ring: "border-violet-ring", fill: "bg-violet" },
  blue: { solid: "text-blue", soft: "bg-blue-soft", ink: "text-blue-ink", ring: "border-blue-ring", fill: "bg-blue" },
  sky: { solid: "text-sky", soft: "bg-sky-soft", ink: "text-sky-ink", ring: "border-sky-ring", fill: "bg-sky" },
  teal: { solid: "text-teal", soft: "bg-teal-soft", ink: "text-teal-ink", ring: "border-teal-ring", fill: "bg-teal" },
  green: { solid: "text-green", soft: "bg-green-soft", ink: "text-green-ink", ring: "border-green-ring", fill: "bg-green" },
  lime: { solid: "text-lime", soft: "bg-lime-soft", ink: "text-lime-ink", ring: "border-lime-ring", fill: "bg-lime" },
  amber: { solid: "text-amber", soft: "bg-amber-soft", ink: "text-amber-ink", ring: "border-amber-ring", fill: "bg-amber" },
  orange: { solid: "text-orange", soft: "bg-orange-soft", ink: "text-orange-ink", ring: "border-orange-ring", fill: "bg-orange" },
  rose: { solid: "text-rose", soft: "bg-rose-soft", ink: "text-rose-ink", ring: "border-rose-ring", fill: "bg-rose" },
  pink: { solid: "text-pink", soft: "bg-pink-soft", ink: "text-pink-ink", ring: "border-pink-ring", fill: "bg-pink" },
}

/* CSS colour strings for inline styles and chart props. */
export const hueVar = (hue: Hue, step: "" | "soft" | "ink" | "ring" = ""): string =>
  `var(--${hue}${step ? `-${step}` : ""})`

/* Hue per key figure (spec §2), so the same figure wears the same colour on
   every page. */
export const FIGURE_HUE = {
  cash: "blue",
  balance: "blue",
  profit: "green",
  income: "green",
  expense: "rose",
  fixedCosts: "amber",
  net: "violet",
  target: "teal",
  subscriptions: "violet",
  people: "sky",
} as const satisfies Record<string, Hue>

/* djb2 — small, deterministic, well spread for short labels. */
function hash(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i)
  return h >>> 0
}

/* A stable hue for a person or client name: the same name is always the same
   colour, on every page and every load. Rose is left out so an avatar never
   reads as "money out". */
const NAME_HUES: Hue[] = HUES.filter((h) => h !== "rose")
export function nameHue(name: string | null | undefined): Hue {
  const key = (name ?? "").trim().toLowerCase()
  if (!key) return "blue"
  return NAME_HUES[hash(key) % NAME_HUES.length]
}

/* Up to two initials: "Psycle London" → "PL", "bigvu" → "B". */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  const first = words[0][0] ?? ""
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : ""
  return (first + last).toUpperCase()
}
