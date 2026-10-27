import * as React from "react"
import { ChartNoise } from "../charts/ChartNoise"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* The donut card (Ledger's Overview, "Expense Category", Figma 67:1205): a
   card header with a title and a meta line, a count over the figure, a
   legend of slices with their share, an action under it, and a donut of the
   slices with the Figma noise on it. Hovering (or focusing) a slice or a
   legend row picks it out in both places.

   FigureCard is the card itself and LegendItem one legend row, shared with
   FunnelCard; use them for another chart in the same card. */

/* The card hairline from the preview: neutral-72 at 45%. */
const HAIRLINE = "border-[color-mix(in_srgb,var(--neutral-72)_45%,transparent)]"

/* The header's right side: an icon, the figure in the figure colour and the
   muted words after it ("78 days of runway"). */
export interface CardMeta {
  value: React.ReactNode
  text: React.ReactNode
  /* Defaults to the clock. */
  icon?: React.ReactNode
}

export function FigureCard({
  title,
  meta,
  count,
  countLabel,
  figure,
  legend,
  action,
  visual,
  className,
}: {
  title: React.ReactNode
  meta?: CardMeta | null
  /* The mono count over the figure ("3 accounts"); leave it out for none. */
  count?: number
  countLabel?: React.ReactNode
  /* The figure, formatted by the caller (taka() from lib/money). */
  figure: React.ReactNode
  legend: React.ReactNode
  action?: React.ReactNode
  /* The chart on the right (under the figure in a narrow card). */
  visual: React.ReactNode
  className?: string
}) {
  return (
    <article className={cn("@container flex min-w-0 flex-col rounded-2xl border bg-card", HAIRLINE, className)}>
      <div className={cn("flex min-h-11 flex-wrap items-center justify-between gap-2.5 border-b px-4 py-3 text-xs", HAIRLINE)}>
        <h3 className="font-medium text-text-figure">{title}</h3>
        {meta ? (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            {meta.icon ?? <Icons.timeSolid aria-hidden className="size-4 text-icon-muted" />}
            <span className="font-medium text-text-figure">{meta.value}</span>
            {meta.text}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col justify-between gap-5 @lg:flex-row">
        <div className="flex min-w-0 flex-col justify-between gap-4 p-4">
          <div className="flex flex-col gap-2.5">
            {count != null ? (
              <span className="inline-flex items-center gap-1 px-1 text-text-secondary text-xs">
                <span className="text-label-mono text-text-figure tabular-nums">{count.toLocaleString()}</span>
                {countLabel}
              </span>
            ) : null}
            <span className="font-medium text-4xl text-text-figure tabular-nums">{figure}</span>
          </div>
          {legend}
          {action ? <div>{action}</div> : null}
        </div>
        <div className="grid flex-none place-items-center px-8 pt-0 pb-6 @lg:pt-6">{visual}</div>
      </div>
    </article>
  )
}

/* One legend row: swatch, mono figure, muted name. A button so keyboard
   users can pick a slice out too (focus does what hover does). */
export function LegendItem({
  name,
  color,
  value,
  active,
  onPick,
  valueClassName,
}: {
  name: string
  /* A CSS colour. */
  color: string
  value: React.ReactNode
  /* The picked-out name, or null; every other row fades. */
  active: string | null
  onPick: (name: string | null) => void
  valueClassName?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-max cursor-pointer items-center gap-1 whitespace-nowrap rounded-sm px-1 text-left transition-opacity duration-fast",
        active && active !== name && "opacity-40",
      )}
      onPointerEnter={() => onPick(name)}
      onFocus={() => onPick(name)}
      onBlur={() => onPick(null)}
    >
      <span aria-hidden className="size-3 shrink-0" style={{ backgroundColor: color }} />
      <span className={cn("text-label-mono text-text-figure tabular-nums", valueClassName)}>{value}</span>
      <span className="text-text-secondary text-xs">{name}</span>
    </button>
  )
}

/* ── Donut ───────────────────────────────────────────────────────────────── */

export interface DonutSlice {
  name: string
  /* A CSS colour: a category colour, a hue, or MISC_COLOUR for the rest. */
  color: string
  value: number
  /* Whole per cent shown in the legend; worked out from `total` when left out. */
  pct?: number
}

/* The donut's "everything else" slice. */
export const MISC_COLOUR = "var(--chart-misc)"

const SIZE = 200
const R = 100
const R0 = 80

function point(a: number, rad: number): string {
  return `${SIZE / 2 + rad * Math.cos(a)} ${SIZE / 2 + rad * Math.sin(a)}`
}

/* Ring segment from angle a0 to a1 (radians, clockwise, 0 = 3 o'clock). */
function arc(a0: number, a1: number): string {
  /* A full circle has no distinct end point; stop a hair short of it. */
  const end = Math.min(a1, a0 + Math.PI * 2 - 1e-4)
  const big = end - a0 > Math.PI ? 1 : 0
  return `M${point(a0, R)}A${R} ${R} 0 ${big} 1 ${point(end, R)}L${point(end, R0)}A${R0} ${R0} 0 ${big} 0 ${point(a0, R0)}Z`
}

/* The 200px ring on its own, for a card of your own. */
export function Donut({
  slices,
  total,
  active,
  onPick,
  label,
}: {
  slices: Array<DonutSlice & { pct: number }>
  total: number
  active: string | null
  onPick: (name: string | null) => void
  /* The whole accessible name: "Expenses by category: Rent 40%, …". */
  label: string
}) {
  const grain = `grain-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  let a0 = -Math.PI / 2
  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label} onPointerLeave={() => onPick(null)}>
      <defs>
        {/* The Figma noise on the donut (size 0.91, density 100%, black at 30%, overlay). */}
        <ChartNoise id={grain} ink="var(--noise-ink-strong)" frequency={1.1} blend="overlay" />
      </defs>
      {total > 0 ? (
        slices.map((s) => {
          const start = a0
          a0 += (s.value / total) * Math.PI * 2
          return (
            <path
              key={s.name}
              d={arc(start, a0)}
              fill={s.color}
              filter={`url(#${grain})`}
              className={cn("cursor-pointer transition-opacity duration-fast", active && active !== s.name && "opacity-30")}
              onPointerEnter={() => onPick(s.name)}
            />
          )
        })
      ) : (
        <path d={arc(-Math.PI / 2, Math.PI * 1.5)} className="fill-track" />
      )}
    </svg>
  )
}

export function DonutCard({
  title,
  meta,
  count,
  countLabel,
  figure,
  slices,
  total,
  chartLabel,
  emptyLabel,
  action,
  className,
}: {
  title: React.ReactNode
  meta?: CardMeta | null
  count?: number
  countLabel?: React.ReactNode
  /* The figure, formatted by the caller (taka() from lib/money). */
  figure: React.ReactNode
  /* Largest first; fold the tail into one MISC_COLOUR slice (four plus Misc reads best). */
  slices: DonutSlice[]
  /* What the ring divides; defaults to the sum of the slices. */
  total?: number
  /* Names the donut: "Expenses by category" (the shares are added). */
  chartLabel: string
  /* Said when there are no slices: "No expenses in this period". */
  emptyLabel: string
  /* Under the legend: a secondary md Button, "View more". */
  action?: React.ReactNode
  className?: string
}) {
  const [active, setActive] = React.useState<string | null>(null)
  const sum = total ?? slices.reduce((t, s) => t + s.value, 0)
  const rows = slices.map((s) => ({ ...s, pct: s.pct ?? (sum > 0 ? Math.round((s.value / sum) * 100) : 0) }))

  return (
    <FigureCard
      title={title}
      meta={meta}
      count={count}
      countLabel={countLabel}
      figure={figure}
      className={className}
      legend={
        rows.length ? (
          <div className="grid grid-cols-[repeat(2,max-content)] justify-start gap-x-6 gap-y-2.5" onPointerLeave={() => setActive(null)}>
            {rows.map((s) => (
              <LegendItem key={s.name} name={s.name} color={s.color} value={`${s.pct}%`} active={active} onPick={setActive} />
            ))}
          </div>
        ) : (
          <p className="px-1 text-text-secondary text-xs">{emptyLabel}.</p>
        )
      }
      action={action}
      visual={
        <Donut
          slices={rows}
          total={sum}
          active={active}
          onPick={setActive}
          label={rows.length ? `${chartLabel}: ${rows.map((s) => `${s.name} ${s.pct}%`).join(", ")}` : emptyLabel}
        />
      }
    />
  )
}
