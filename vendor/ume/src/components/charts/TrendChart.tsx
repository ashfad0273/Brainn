import * as React from "react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import { ChartNoise } from "./ChartNoise"

/* The parts of the Overview's chart band (approved preview, "band"), shared
   with the Subscriptions page: the view tabs, the trend chart (three money
   labels on hairlines, five dashed guides, the noise-filled area under a
   1.5px line, the cursor, knob and tip on hover) and the period bar under
   it (the elapsed share split by colour, the rest on the track). */

export type ChartTone = "neutral" | "violet" | "rose" | "amber" | "orange"

/* Line, knob and area colour per tone, as utilities over the tokens. The
   area is a faint wash of the tone (--chart-area-*). */
export const CHART_TONE: Record<ChartTone, { stroke: string; border: string; area: string }> = {
  neutral: { stroke: "stroke-chart-line", border: "border-chart-line", area: "fill-chart-area" },
  violet: { stroke: "stroke-violet", border: "border-violet", area: "fill-chart-area-income" },
  rose: { stroke: "stroke-rose", border: "border-rose", area: "fill-chart-area-expense" },
  amber: { stroke: "stroke-amber", border: "border-amber", area: "fill-chart-area-profit" },
  orange: { stroke: "stroke-orange", border: "border-orange", area: "fill-chart-area-due" },
}

/* Dashed vertical guides, as fractions of the plot width (the preview's five). */
const GUIDES = [0, 0.2, 0.4, 0.6, 0.8]

/* The view tabs: ghost lg buttons, roving focus, arrows move and select. */
export function ChartTabs<T extends string>({
  tabs,
  value,
  onChange,
  baseId,
}: {
  tabs: ReadonlyArray<readonly [T, string]>
  value: T
  onChange: (t: T) => void
  baseId: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const onKey = (e: React.KeyboardEvent) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"]
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const i = tabs.findIndex(([t]) => t === value)
    const n =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? tabs.length - 1
          : (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length
    const next = tabs[n][0]
    onChange(next)
    ref.current?.querySelector<HTMLElement>(`[data-tab="${next}"]`)?.focus()
  }
  return (
    <div ref={ref} role="tablist" aria-label="Chart view" className="flex flex-wrap gap-2" onKeyDown={onKey}>
      {tabs.map(([t, label]) => (
        <Button
          key={t}
          variant="ghost"
          size="lg"
          role="tab"
          id={`${baseId}-tab-${t}`}
          data-tab={t}
          aria-selected={t === value}
          aria-controls={`${baseId}-panel`}
          tabIndex={t === value ? 0 : -1}
          onClick={() => onChange(t)}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

/* The trend chart. `values` are drawn left to right over `total` slots
   (the whole window); points after `solidCount` are drawn lighter, for days
   still to come that are already known (renewals). `ghost` is a second
   series drawn lighter under the line, without an area, on the same scale
   (Projects: the value booked, behind what came in), in `ghostTone` when it
   differs from the line's. */
export function TrendChart({
  values,
  total,
  solidCount = values.length,
  tone,
  ariaLabel,
  formatY,
  tip,
  ghost,
  ghostTone,
  className,
}: {
  values: number[]
  total: number
  solidCount?: number
  ghost?: number[]
  ghostTone?: ChartTone
  tone: ChartTone
  ariaLabel: string
  formatY: (n: number) => string
  tip: (index: number) => React.ReactNode
  className?: string
}) {
  const noiseId = `trend-noise-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  /* Measure the plot so the SVG draws at real pixel size and the noise
     filter isn't stretched. */
  const plotRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  React.useLayoutEffect(() => {
    const el = plotRef.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const all = ghost ? values.concat(ghost) : values
  const hi = Math.max(0, ...all)
  const lo = Math.min(0, ...all)
  const flat = hi === lo
  const { w, h } = size
  const xAt = (i: number) => (total <= 1 ? w / 2 : (i / (total - 1)) * w)
  const yAt = (v: number) => (flat ? h : ((hi - v) / (hi - lo)) * h)
  const pts: Array<[number, number]> = values.length
    ? values.map((v, i) => [xAt(i), yAt(v)])
    : [
        [0, h],
        [w, h],
      ]
  const path = (list: Array<[number, number]>) =>
    list.length ? "M" + list.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") : ""
  const lineD = path(pts)
  const last = pts[pts.length - 1]
  const areaD = `${lineD}L${last[0].toFixed(1)} ${h}L${pts[0][0].toFixed(1)} ${h}Z`
  const solid = Math.max(1, Math.min(solidCount, pts.length))
  const solidD = path(pts.slice(0, solid))
  const aheadD = solid < pts.length ? path(pts.slice(solid - 1)) : ""
  const ghostPts: Array<[number, number]> = ghost ? ghost.map((v, i) => [xAt(i), yAt(v)]) : []
  const ghostD = path(ghostPts)
  /* The hover reaches as far as either series. */
  const reach = Math.max(values.length, ghostPts.length)

  const yLabels = flat ? ["", "", formatY(0)] : [formatY(hi), formatY((hi + lo) / 2), formatY(lo)]

  const [hover, setHover] = React.useState<number | null>(null)
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!reach || !w) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const i = total <= 1 ? 0 : Math.round((x / w) * (total - 1))
    setHover(Math.max(0, Math.min(reach - 1, i)))
  }
  const hv = hover != null && hover < reach ? hover : null
  const hvPt = hv == null ? null : hv < values.length ? pts[hv] : ghostPts[hv]
  const t = CHART_TONE[tone]

  return (
    <div className={cn("relative h-83.5", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {yLabels.map((l, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-xs text-text-secondary tabular-nums after:h-px after:flex-1 after:bg-border-subtle after:content-['']"
          >
            {l}
          </div>
        ))}
      </div>
      <div
        ref={plotRef}
        className="absolute top-2.25 right-0 bottom-2.25 left-12"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {w > 0 && h > 0 ? (
          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block overflow-visible" role="img" aria-label={ariaLabel}>
            <defs>
              <ChartNoise id={noiseId} ink="var(--noise-ink)" />
            </defs>
            {GUIDES.map((f) => (
              <line key={f} x1={f * w} x2={f * w} y1={0} y2={h} strokeDasharray="4 4" className="stroke-border-subtle" />
            ))}
            <path d={areaD} filter={`url(#${noiseId})`} className={cn(t.area, "transition-[fill] duration-base ease-out")} />
            {ghostD ? (
              <path
                d={ghostD}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(CHART_TONE[ghostTone ?? tone].stroke, "opacity-35 transition-[stroke] duration-base ease-out")}
              />
            ) : null}
            <path
              d={solidD}
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn(t.stroke, "transition-[stroke] duration-base ease-out")}
            />
            {aheadD ? (
              <path
                d={aheadD}
                fill="none"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={cn(t.stroke, "opacity-35 transition-[stroke] duration-base ease-out")}
              />
            ) : null}
          </svg>
        ) : null}
        {hv != null && hvPt ? (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-text-disabled" style={{ left: hvPt[0] }} />
            <div
              className={cn(
                "pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-card",
                t.border,
              )}
              style={{ left: hvPt[0], top: hvPt[1] }}
            />
            <div
              className="pointer-events-none absolute z-5 min-w-44 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-xl border border-border-subtle bg-card px-3 py-2.5 text-xs shadow-pop"
              style={{ left: Math.max(100, Math.min(w - 100, hvPt[0])), top: hvPt[1] }}
            >
              {tip(hv)}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

/* A chart tip laid out as a small card: the day on top in Label Mono over a
   hairline, then one row per series with its swatch, name and figure. */
export function TipDate({ children }: { children: React.ReactNode }) {
  return <div className="border-border-subtle border-b pb-1.5 text-label-mono text-text-secondary">{children}</div>
}

export function TipRow({ swatch, label, value }: { swatch: string; label: string; value: React.ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <i aria-hidden className={cn("size-2.5 shrink-0 rounded-xs", swatch)} />
      <span className="text-text-secondary">{label}</span>
      <b className="ms-auto ps-4 font-medium text-text-figure tabular-nums">{value}</b>
    </div>
  )
}

/* The period bar: the elapsed share split by colour, then the rest on the
   track, with its legend row under it. */
export function PeriodBar({
  segments,
  children,
}: {
  segments: Array<{ key: string; grow: number; cls: string }>
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div aria-hidden className="flex h-1.5 gap-2.5">
        {segments
          .filter((s) => s.grow > 0)
          .map((s) => (
            <i
              key={s.key}
              className={cn("block h-1.5 transition-[flex-grow] duration-base ease-out", s.cls)}
              style={{ flexGrow: s.grow }}
            />
          ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2.5">{children}</div>
    </div>
  )
}

/* A legend entry under the period bar: a 12px square, the mono label and a
   figure ("Time period 23 days"). */
export function PeriodKey({ swatch, label, value }: { swatch: string; label: string; value?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-1 text-label-mono text-text-secondary">
      <i aria-hidden className={cn("block size-3 shrink-0", swatch)} />
      {label}
      {value != null ? <span className="text-text-figure">{value}</span> : null}
    </span>
  )
}

/* The rounded pill beside the legend (the Overview's delta): a 6px dot and
   a line of text. Without `good` there is no dot (the Transactions month
   totals). */
export function PeriodPill({ good, children }: { good?: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border-subtle bg-card px-3 text-xs shadow-xs">
      {good === undefined ? null : (
        <i aria-hidden className={cn("block size-1.5 shrink-0 rounded-full", good ? "bg-icon-success" : "bg-icon-danger")} />
      )}
      <span>{children}</span>
    </span>
  )
}
