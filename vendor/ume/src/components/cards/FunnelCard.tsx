import * as React from "react"
import { ChartNoise } from "../charts/ChartNoise"
import { cn } from "../../lib/utils"
import { FigureCard, LegendItem, type CardMeta } from "./DonutCard"

/* The funnel card (Ledger's Overview, "Income pipeline", from the preview's
   "Payouts in authorization"): the donut card's shell with a legend of
   stages and their counts, and a funnel whose bands take a share of its
   height by count, top of the funnel to the tip. An empty stage gets no
   height and shows only its top line. Hovering a band or a legend row picks
   it out in both places. */

export interface FunnelStage {
  name: string
  count: number
  /* The stage's line and legend swatch, a CSS colour: "var(--green)". */
  solid: string
  /* The band's fill, a CSS colour: "var(--green-soft)". */
  soft: string
}

/* The funnel's left edge from Figma, top to tip: four segments that steepen
   as they go down. The right edge mirrors it around the centre line. */
const EDGE = [
  [32, 37],
  [49.154, 91.893],
  [66.308, 147.214],
  [100.616, 202.107],
  [143.501, 257],
] as const
const MID = 143.501
const TOP = EDGE[0][1]
const TIP = EDGE[EDGE.length - 1][1]

/* Left x of the outline at height y, interpolated along its edge segment. */
const edgeX = (y: number) => {
  for (let i = 1; i < EDGE.length; i++) {
    const [x0, y0] = EDGE[i - 1]
    const [x1, y1] = EDGE[i]
    if (y <= y1) return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0)
  }
  return MID
}

const round = (n: number) => Math.round(n * 1000) / 1000

/* The slice of the funnel between two heights: down the left edge (through
   any corners in between), across, and back up the right edge. A slice that
   reaches the tip closes as a triangle. */
const slice = (top: number, bottom: number) => {
  const ys = [top, ...EDGE.map(([, y]) => y).filter((y) => y > top && y < bottom), bottom]
  const left = ys.map((y) => [edgeX(y), y])
  const right = left.map(([x, y]) => [2 * MID - x, y]).reverse()
  const points = bottom >= TIP ? [...left, ...right.slice(1)] : [...left, ...right]
  return `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`
}

/* The 223 × 220 funnel on its own, for a card of your own. */
export function Funnel({
  stages,
  active,
  onPick,
  label,
}: {
  stages: FunnelStage[]
  active: string | null
  onPick: (name: string | null) => void
  /* The whole accessible name: "Income by stage: Received 12, …". */
  label: string
}) {
  const grain = `grain-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  /* Split the height between the stages in order, by count. */
  const countTotal = stages.reduce((n, s) => n + s.count, 0)
  let edge = TOP
  const bands = stages.map((s) => {
    const top = edge
    if (countTotal) edge += ((TIP - TOP) * s.count) / countTotal
    return { ...s, top, bottom: edge }
  })

  return (
    <svg width={223} height={220} viewBox="32 37 223.002 220" role="img" aria-label={label} onPointerLeave={() => onPick(null)}>
      <defs>
        {/* The trend chart's grain (fine dots at --noise-ink): the donut's
            overlay grain all but vanishes on the funnel's pale fills. */}
        <ChartNoise id={grain} ink="var(--noise-ink)" />
      </defs>
      {/* Nothing counted yet: just the empty funnel. */}
      {!countTotal && <path d={slice(TOP, TIP)} className="fill-track" />}
      {bands.map((s) => (
        <g
          key={s.name}
          className={cn("cursor-pointer transition-opacity duration-fast", active && active !== s.name && "opacity-30")}
          onPointerEnter={() => onPick(s.name)}
        >
          {s.bottom > s.top && <path d={slice(s.top, s.bottom)} fill={s.soft} filter={`url(#${grain})`} />}
          <line
            x1={round(edgeX(s.top))}
            y1={round(s.top)}
            x2={round(2 * MID - edgeX(s.top))}
            y2={round(s.top)}
            stroke={s.solid}
            strokeWidth={0.86}
          />
        </g>
      ))}
    </svg>
  )
}

export function FunnelCard({
  title,
  meta,
  count,
  countLabel,
  figure,
  stages,
  chartLabel,
  action,
  className,
}: {
  title: React.ReactNode
  meta?: CardMeta | null
  count?: number
  countLabel?: React.ReactNode
  /* The figure, formatted by the caller (taka() from lib/money). */
  figure: React.ReactNode
  /* Top of the funnel to the tip; three to five reads best. */
  stages: FunnelStage[]
  /* Names the funnel: "Income by stage" (the counts are added). */
  chartLabel: string
  /* Under the legend: a secondary md Button, "View more". */
  action?: React.ReactNode
  className?: string
}) {
  const [active, setActive] = React.useState<string | null>(null)
  return (
    <FigureCard
      title={title}
      meta={meta}
      count={count}
      countLabel={countLabel}
      figure={figure}
      className={className}
      legend={
        <div className="grid grid-cols-[max-content] justify-start gap-x-6 gap-y-2.5" onPointerLeave={() => setActive(null)}>
          {stages.map((s) => (
            <LegendItem
              key={s.name}
              name={s.name}
              color={s.solid}
              value={String(s.count)}
              valueClassName="min-w-3"
              active={active}
              onPick={setActive}
            />
          ))}
        </div>
      }
      action={action}
      visual={
        <Funnel
          stages={stages}
          active={active}
          onPick={setActive}
          label={`${chartLabel}: ${stages.map((s) => `${s.name} ${s.count}`).join(", ")}`}
        />
      }
    />
  )
}
