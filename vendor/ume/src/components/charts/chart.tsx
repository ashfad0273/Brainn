import * as React from "react"
import { cn } from "../../lib/utils"
import type { ChartConfig } from "./recharts-chart"

/* Shared glue for every chart in Ume (components/charts: TrendChart, and any
   Recharts chart built on recharts-chart.tsx). Charts import their colours,
   tooltip style and accessible wrapper from here so they can't drift apart. */

type SeriesColors = NonNullable<ChartConfig[string]["colors"]>

/* Colours are theme tokens from ume.css, which already switch in dark mode,
   so only the `light` slot is set; the chart applies it in both themes. */
export function tokenColors(...tokens: string[]): SeriesColors {
  return { light: tokens }
}

/* Categorical palette for series without a semantic colour (categories,
   subscriptions): cycles --chart-1 … --chart-7. */
export function seriesColor(i: number): string {
  return `var(--chart-${(i % 7) + 1})`
}

/* Semantic series colours — income, expense and net read the same in every
   chart. */
export const seriesTokens = {
  income: "var(--pos)",
  expense: "var(--neg)",
  net: "var(--foreground)",
} as const

/* Spread onto every `<EvilXChart.Tooltip />`. */
export const tooltipProps = { variant: "default", roundness: "lg" } as const

/* Spread onto every `<EvilXChart.Legend />`. */
export const legendProps = { variant: "circle", align: "left", verticalAlign: "bottom" } as const

/* `label` names the chart and `summary` states what it plots in words, so a
   screen reader gets what a sighted user reads off the axes. The summary sits
   outside the role="img" element — that role hides its own descendants from
   the accessibility tree. */
export function ChartFrame({
  className,
  children,
  label,
  summary,
}: {
  className?: string
  children: React.ReactNode
  label: string
  summary?: string
}) {
  return (
    <>
      <div className={cn("w-full", className)} role="img" aria-label={label}>
        {children}
      </div>
      {summary ? <span className="sr-only">{summary}</span> : null}
    </>
  )
}

/* A chart legend key: the Label Mono caption beside its swatch. */
export const legendKey = "inline-flex items-center gap-1 px-1 text-label-mono text-text-secondary"
