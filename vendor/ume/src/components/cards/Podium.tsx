import * as React from "react"
import { useIsNarrowerThan } from "../../hooks/use-media-query"
import { HUE_CLASSES, hueVar, type Hue } from "../../lib/hue"
import { cn } from "../../lib/utils"

/* The podium (Ledger's People, approved preview Oct 2026): three cards for
   1st, 2nd and 3rd. Each card's rank line drops by how far it trails first
   place (0–64px, at least 20px below the one before) and its box starts at
   that line: the tint fades down from it and the divider to its right starts
   at the lower of the two lines it separates. Under 600px of its own width
   the cards stack and nothing drops.

   The tint is an approved gradient (as StatTiles), so this file is on
   check-conventions' GRADIENT_ALLOWLIST. Rank colours are fixed: 1st pink,
   2nd orange, 3rd blue, everyone else grey. ShareBar goes under it: the top
   three against the rest. */

export const RANK_HUES: readonly Hue[] = ["pink", "orange", "blue"]
const REST = "var(--neutral-82)"

/* The colour of a rank (1-based): its hue, or grey past third place. */
export const rankColor = (rank: number | null | undefined): string =>
  rank && rank <= 3 ? hueVar(RANK_HUES[rank - 1]) : REST

const ORDINAL = ["1st", "2nd", "3rd"] as const

/* The small square key in a rank's colour, as the legends use. */
export function RankTick({ rank, className }: { rank: number | null | undefined; className?: string }) {
  return <i aria-hidden className={cn("block size-3 shrink-0", className)} style={{ background: rankColor(rank) }} />
}

/* The rank badge: "Highest value", "2nd highest"… on its hue's soft surface,
   semibold through --weight-semibold (the stated exception, as MonthPill). */
export function RankBadge({ rank, children }: { rank: number; children: React.ReactNode }) {
  const hue = RANK_HUES[rank - 1] ?? RANK_HUES[2]
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md px-2 font-(--weight-semibold) text-xs",
        HUE_CLASSES[hue].soft,
        HUE_CLASSES[hue].ink,
      )}
    >
      {children}
    </span>
  )
}

export interface PodiumEntry {
  id: string
  name: string
  /* Full name for the hover title when `name` is shortened. */
  title?: string
  /* The muted line under the name. */
  sub: React.ReactNode
  /* The rank badge's words: "Highest value". */
  badge: React.ReactNode
  count: number
  /* [singular, plural]: ["payment", "payments"]. */
  unit: readonly [string, string]
  /* Whole per cent of the total. */
  share: number
  /* The figure, formatted by the caller (taka() from lib/money). */
  amount: React.ReactNode
  /* The raw value, for how far each card drops below first place. */
  value: number
}

const MAX_DROP = 64

export function Podium({
  entries,
  onOpen,
  selected,
  shareLabel = "of the total",
  empty = (place) => (place === 1 ? "No one in this period yet" : `No ${ORDINAL[place - 1]} place in this period`),
  className,
}: {
  /* First, second and third, in order; a missing place shows `empty`. */
  entries: PodiumEntry[]
  /* Makes each filled card a button that opens that entry. */
  onOpen?: (id: string, from: HTMLElement) => void
  /* The open entry's id; its card shows pressed. */
  selected?: string | null
  /* The words after the share: "8% of the total". */
  shareLabel?: string
  /* What an empty place says. */
  empty?: (place: 1 | 2 | 3) => React.ReactNode
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const stacked = useIsNarrowerThan(ref, 600)
  const lead = entries[0]?.value ?? 0
  let last = 0
  const drops = [0, 1, 2].map((i) => {
    const e = entries[i]
    const want = e && lead ? Math.round(MAX_DROP * (1 - e.value / lead)) : MAX_DROP
    last = i === 0 ? 0 : Math.min(MAX_DROP, Math.max(want, last + 20))
    return stacked ? 0 : last
  })

  return (
    <div ref={ref} className={cn("grid flex-1", stacked ? "grid-cols-1" : "grid-cols-3", className)}>
      {([1, 2, 3] as const).map((place, i) => {
        const e = entries[i]
        const drop = drops[i]
        const edge = drops[i + 1] ?? 0
        const style = {
          "--c": hueVar(RANK_HUES[i]),
          background: `linear-gradient(180deg, transparent ${drop}px, color-mix(in srgb, var(--c) var(--wash, 3.5%), transparent) ${drop}px, transparent 65%)`,
          paddingTop: drop + 16,
        } as React.CSSProperties
        const body = e ? (
          <>
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <RankTick rank={place} />
                  <span className="truncate font-medium text-sm text-text-figure" title={e.title ?? e.name}>
                    {e.name}
                  </span>
                </span>
                <span className="truncate ps-5 text-text-secondary text-xs">{e.sub}</span>
              </span>
              <RankBadge rank={place}>{e.badge}</RankBadge>
            </span>
            <span className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-1 px-1 text-xs">
                <span className="text-label-mono text-text-figure tabular-nums">{e.count}</span>
                <span className="text-text-secondary">{e.count === 1 ? e.unit[0] : e.unit[1]}</span>
                <span className="text-text-tertiary">·</span>
                <span className="text-label-mono text-text-figure tabular-nums">{e.share}%</span>
                <span className="text-text-secondary">{shareLabel}</span>
              </span>
              <span className="font-medium text-3xl text-text-figure tabular-nums">{e.amount}</span>
            </span>
          </>
        ) : (
          <span className="text-sm text-text-secondary">{empty(place)}</span>
        )
        const common = cn(
          "relative flex min-h-59 flex-col justify-between gap-8 px-6 pb-5 text-start",
          stacked && "min-h-0 gap-5 border-border-subtle border-b",
        )
        const marks = (
          <>
            <span
              aria-hidden
              className="absolute inset-x-0 h-0.5"
              style={{ top: drop, background: e ? "color-mix(in srgb, var(--c) 70%, var(--card))" : "var(--border-subtle)" }}
            />
            {!stacked && i < 2 ? (
              <span aria-hidden className="absolute end-0 bottom-0 w-px bg-border-subtle" style={{ top: edge }} />
            ) : null}
          </>
        )
        return e && onOpen ? (
          <button
            key={place}
            type="button"
            aria-label={`${ORDINAL[i]}: ${e.title ?? e.name}`}
            aria-pressed={selected === e.id}
            onClick={(ev) => onOpen(e.id, ev.currentTarget)}
            style={style}
            className={cn(
              common,
              "cursor-pointer border-0 outline-none hover:[--wash:6%] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-pressed:[--wash:6%]",
            )}
          >
            {marks}
            {body}
          </button>
        ) : (
          <div key={place} style={e ? style : { paddingTop: drop + 16 }} className={common}>
            {marks}
            {body}
          </div>
        )
      })}
    </div>
  )
}

export interface ShareSegment {
  name: string
  value: number
  /* 1–3 for the podium's colours; anything else (or null) is grey. */
  rank: number | null
}

/* The share bar under the podium: each segment's share of `total` as a
   6px bar in its rank colour, with its legend. A hairline over it closes off
   the cards. */
export function ShareBar({
  segments,
  total,
  label = "Share",
  className,
}: {
  segments: ShareSegment[]
  total: number
  /* Starts the bar's accessible name: "Share: Acme 42%, …". */
  label?: string
  className?: string
}) {
  if (!total) return null
  const pct = (v: number) => Math.round((v / total) * 100)
  return (
    <div className={cn("flex flex-col gap-2.5 border-border-subtle border-t px-3 pt-5 pb-3", className)}>
      <div
        className="flex h-1.5 gap-0.5"
        role="img"
        aria-label={`${label}: ${segments.map((s) => `${s.name} ${pct(s.value)}%`).join(", ")}`}
      >
        {segments.map((s) => (
          <i key={s.name} className="block h-1.5" style={{ flexGrow: s.value, background: rankColor(s.rank) }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1 px-1 text-label-mono text-text-secondary">
            <RankTick rank={s.rank} />
            {s.name}
            <span className="text-text-figure tabular-nums">{pct(s.value)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}
