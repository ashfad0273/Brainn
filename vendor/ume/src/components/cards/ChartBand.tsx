import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { ChartTabs, PeriodBar, PeriodKey, PeriodPill, TrendChart } from "../charts/TrendChart"
import { SegmentedPill } from "../ui/segmented-pill"
import { choiceMenu, choiceMenuBody, choiceMenuRow, choiceMenuTitle } from "../patterns/surface"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* The chart band (Ledger's Overview, approved preview "band"; Subscriptions
   and Projects use it as built): the view tabs with the page's pills on the
   right, the trend chart for the selected view, and the period bar under it
   with a key at each end and a pill beside the first. The band owns the tab
   ids and the tabpanel that ties the tabs to the chart; the caller works out
   the series and hands TrendChart's props through `chart`.

   YearPill is the Year picker two of the bands put on the right. */

type TrendChartProps = React.ComponentProps<typeof TrendChart>

/* A key under the bar: a 12px square, the mono label and an optional figure. */
export interface BandKey {
  swatch: string
  label: string
  value?: React.ReactNode
}

export interface BandBar {
  /* Each part's flex share and colour class; parts with no share are left out. */
  segments: Array<{ key: string; grow: number; cls: string }>
  /* The key at the start: "Time period 23 days". */
  start?: BandKey
  /* The pill beside it; `good` puts a green or rose dot before the text. */
  pill?: { good?: boolean; text: React.ReactNode } | null
  /* The key at the end: "Remaining 8 days". */
  end?: BandKey
}

export function ChartBand<T extends string>({
  label,
  tabs,
  tab,
  onTabChange,
  controls,
  chart,
  bar,
  className,
}: {
  /* Names the band for screen readers: "Trend", "Costs over the year". */
  label: string
  tabs: ReadonlyArray<readonly [T, string]>
  tab: T
  onTabChange: (t: T) => void
  /* The pills on the right: Date and Filter, or a YearPill. */
  controls?: React.ReactNode
  /* TrendChart's props for the selected view. */
  chart: TrendChartProps
  bar?: BandBar
  className?: string
}) {
  const baseId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "")
  return (
    <section className={cn("flex flex-col gap-5 border-border-subtle border-b p-4 sm:p-6", className)} aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <ChartTabs tabs={tabs} value={tab} onChange={onTabChange} baseId={baseId} />
        {controls ? <div className="flex items-center gap-2">{controls}</div> : null}
      </div>

      <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="flex flex-col gap-5">
        <TrendChart {...chart} />
        {bar ? (
          <PeriodBar segments={bar.segments}>
            <div className="flex flex-wrap items-center gap-2.5">
              {bar.start ? <PeriodKey {...bar.start} /> : null}
              {bar.pill ? <PeriodPill good={bar.pill.good}>{bar.pill.text}</PeriodPill> : null}
            </div>
            {bar.end ? <PeriodKey {...bar.end} /> : null}
          </PeriodBar>
        ) : null}
      </div>
    </section>
  )
}

/* The Year pill and its choice menu: "Year 2026", a tick on the one shown. */
export function YearPill({
  value,
  options,
  onChange,
  label = "Year",
}: {
  value: number
  /* The years to offer, each with an optional longer row label
     ("2027 · at today's plans"). */
  options: ReadonlyArray<number | { year: number; label: string }>
  onChange: (year: number) => void
  label?: string
}) {
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        render={<SegmentedPill icon={<Icons.dateSolid aria-hidden />} label={label} value={String(value)} aria-label={`${label}: ${value}`} />}
      />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <MenuPrimitive.Popup className={choiceMenu}>
            <div className={choiceMenuBody}>
              <div className={choiceMenuTitle}>{label}</div>
              {options.map((o) => {
                const year = typeof o === "number" ? o : o.year
                return (
                  <MenuPrimitive.Item key={year} onClick={() => onChange(year)} className={`${choiceMenuRow} justify-between`}>
                    <span>{typeof o === "number" ? String(o) : o.label}</span>
                    {year === value ? <Icons.success aria-hidden className="size-4 text-foreground" /> : null}
                  </MenuPrimitive.Item>
                )
              })}
            </div>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}
