"use client"

import * as React from "react"
import { fmtDate, fmtMonth, plural } from "../../lib/format"
import { Icons } from "../../lib/icons"
import {
  PICKER_PRESETS,
  addDays,
  addMonths,
  daysInRange,
  isPreset,
  isoOf,
  monthGrid,
  monthOf,
  parseIso,
  periodLabel,
  periodRange,
  weekdayIndex,
  type Period,
  type PeriodPreset,
  type PeriodPresetOption,
} from "../../lib/period"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover"

/* The period picker (approved component sheet, Oct 2026): a one-month
   calendar on the left — the start and end dates, the month with reset /
   previous / next, a Monday-first grid and an "N days · Apply" footer — and
   the preset chips on the right. On phones the chips wrap under the
   calendar. Nothing changes until Apply: closing the popover throws the
   draft away.

     import { PeriodPicker } from "@ume/ui/components/pickers/PeriodPicker"

     const [period, setPeriod] = React.useState<Period>("1m")
     <PeriodPicker value={period} onChange={setPeriod} />

   PeriodPicker is the button and its popover. DateRangePanel is the panel on
   its own, for a drawer or a page (`stacked` puts the chips under the
   calendar). PeriodTriggerLabel is what the button says, for a trigger of
   your own. */

/* A draft range. `preset` is the chip it came from, so Apply commits the
   rolling preset ("This month" stays this month in a saved URL) rather than
   today's dates; picking a day clears it. */
type Draft = { from: string | null; to: string | null; preset: PeriodPreset | null }

const WEEKDAYS: Array<[short: string, long: string]> = [
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
  ["Su", "Sunday"],
]

/* "Thursday, October 2, 2026" (in the viewer's locale): what a screen
   reader says for each day. */
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})
const dayLabel = (s: string) => dayFmt.format(parseIso(s))

function draftFromPeriod(p: Period): Draft {
  const r = periodRange(p)
  return { from: r?.from ?? null, to: r?.to ?? null, preset: isPreset(p) ? p : null }
}

/* The month to show for a range: today's when the range covers today (so
   "This year" opens on this month, not December), else the range's end. */
function viewFor({ from, to }: Draft) {
  const today = isoOf(new Date())
  if (from && to && from <= today && today <= to) return monthOf(today)
  return monthOf(to ?? from ?? today)
}

/* First click starts a range, the second ends it (in either order), a third
   starts over. */
function nextDraft(d: Draft, day: string): Draft {
  if (!d.from || d.to) return { from: day, to: null, preset: null }
  if (day < d.from) return { from: day, to: d.from, preset: null }
  return { from: d.from, to: day, preset: null }
}

export interface PeriodPickerProps {
  /* The applied period. */
  value: Period
  /* Called once, on Apply, with the preset or the custom range. */
  onChange: (period: Period) => void
  /* The chips, in order, as [preset, label] pairs. */
  presets?: readonly PeriodPresetOption[]
  /* Replaces the default button (a pill, say). It receives the popover
     trigger's props, so it must accept them and forward a ref. */
  trigger?: React.ReactElement<Record<string, unknown>>
  /* Which edge of the trigger the popover lines up with. */
  align?: "start" | "end"
  /* Said to screen readers after Apply. Defaults to "Showing <period>". */
  announcement?: (period: Period) => string
}

export function PeriodPicker({
  value,
  onChange,
  presets = PICKER_PRESETS,
  trigger,
  align = "end",
  announcement = (p) => `Showing ${periodLabel(p)}`,
}: PeriodPickerProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)
  /* A fresh panel per opening, seeded from the applied period. */
  const [session, setSession] = React.useState(0)
  const [said, setSaid] = React.useState("")
  const panelRef = React.useRef<HTMLDivElement>(null)

  const onOpenChange = (next: boolean) => {
    if (next) setSession((s) => s + 1)
    setOpen(next)
  }

  const apply = (p: Period) => {
    onChange(p)
    setOpen(false)
    /* Cleared first, so the same words twice are still read out. */
    setSaid("")
    window.setTimeout(() => setSaid(announcement(p)), 40)
  }

  return (
    <>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger
          render={
            trigger ?? (
              <Button variant="outline" aria-label={`Time period: ${periodLabel(value)}`} className="gap-2 ps-3.5">
                <Icons.date className="text-primary" />
                <PeriodTriggerLabel period={value} />
                <Icons.chevronDown className="size-4 text-muted-foreground" />
              </Button>
            )
          }
        />
        <PopoverPopup
          align={align}
          aria-label="Choose dates"
          /* Focus lands on the grid's tab stop (the start day), ready for the
             arrow keys. */
          initialFocus={() => panelRef.current?.querySelector<HTMLElement>('[data-date][tabindex="0"]') ?? true}
          className="rounded-pop border-border-subtle bg-card shadow-pop *:data-[slot=popover-viewport]:p-0"
        >
          <DateRangePanel ref={panelRef} key={session} period={value} presets={presets} onApply={apply} />
        </PopoverPopup>
      </Popover>
      <span aria-live="polite" className="sr-only">
        {said}
      </span>
    </>
  )
}

/* What the trigger says: the preset's name, or the range as two dates. */
export function PeriodTriggerLabel({ period }: { period: Period }): React.ReactElement {
  return isPreset(period) ? (
    <>{periodLabel(period)}</>
  ) : (
    <span className="text-xs tabular-nums">
      {fmtDate(period.from)} – {fmtDate(period.to)}
    </span>
  )
}

export interface DateRangePanelProps {
  /* The period to start from. Key the panel on it to re-seed it. */
  period: Period
  /* Called on Apply with the preset or the custom range. */
  onApply: (period: Period) => void
  /* The chips, as [preset, label] pairs. */
  presets?: readonly PeriodPresetOption[]
  /* The chips under the calendar at every width (a drawer), instead of to
     its right. */
  stacked?: boolean
  ref?: React.Ref<HTMLDivElement>
}

/* The calendar and the presets. */
export function DateRangePanel({
  period,
  onApply,
  presets = PICKER_PRESETS,
  stacked = false,
  ref,
}: DateRangePanelProps): React.ReactElement {
  const [draft, setDraft] = React.useState(() => draftFromPeriod(period))
  const [view, setView] = React.useState(() => viewFor(draft))
  const today = isoOf(new Date())
  const [focusDay, setFocusDay] = React.useState(draft.from ?? today)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const moveFocus = React.useRef(false)

  const first = new Date(view.y, view.m, 1)
  const cells = monthGrid(view.y, view.m)
  const weeks = Array.from({ length: 6 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
  /* The roving tab stop: the focused day if it's on screen, else the 1st. */
  const tabStop = cells.includes(focusDay) ? focusDay : isoOf(first)

  const showMonthOf = (day: string) => {
    const { y, m } = monthOf(day)
    if (y !== view.y || m !== view.m) setView({ y, m })
  }
  const shift = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  const pickDay = (day: string) => {
    setDraft((d) => nextDraft(d, day))
    setFocusDay(day)
    showMonthOf(day)
  }

  const pickPreset = (preset: PeriodPreset) => {
    const next = draftFromPeriod(preset)
    setDraft(next)
    setView(viewFor(next))
  }

  /* Keyboard follows the ARIA date-grid pattern: arrows move by day and
     week, Home/End jump to the week's ends, Page Up/Down change month (with
     Shift, year). Moving off the grid pages the calendar along. */
  const onKeyDown = (e: React.KeyboardEvent, day: string) => {
    const step: Record<string, () => string> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -weekdayIndex(day)),
      End: () => addDays(day, 6 - weekdayIndex(day)),
      PageUp: () => addMonths(day, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(day, e.shiftKey ? 12 : 1),
    }
    const next = step[e.key]
    if (!next) return
    e.preventDefault()
    const target = next()
    setFocusDay(target)
    moveFocus.current = true
    if (!cells.includes(target)) showMonthOf(target)
  }

  React.useEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDay}"]`)?.focus()
  }, [focusDay, view])

  const end = draft.to ?? draft.from
  const picking = !!draft.from && !draft.to
  const days = draft.from && draft.to ? daysInRange(draft.from, draft.to) : null
  const canApply = !picking && (draft.preset != null || days != null)

  const apply = () => {
    if (draft.preset) onApply(draft.preset)
    else if (draft.from && draft.to) onApply({ from: draft.from, to: draft.to })
  }

  /* The first column starts on the 10px inset line (with the month and the
     field text), the last ends on it at the right (with the next arrow), the
     columns between are centred. */
  const align = (col: number) =>
    col === 0 ? "justify-start ps-2.5" : col === 6 ? "justify-end pe-2.5" : "justify-center"

  return (
    <div ref={ref} className={cn("flex", stacked ? "flex-col" : "max-sm:flex-col")} data-slot="date-range-panel">
      <div className={cn("flex flex-col gap-3.5 p-4", stacked ? "w-full" : "w-75 max-sm:w-full")}>
        <div className="grid grid-cols-2 gap-2">
          <RangeEnd label="Start date" value={draft.from} />
          <RangeEnd label="End date" value={draft.to} />
        </div>

        <div className="flex items-center justify-between">
          <span aria-live="polite" className="ps-2.5 font-medium text-sm text-text-secondary">
            {fmtMonth(first, "long")}
          </span>
          <div className="me-1 flex gap-0.5">
            <NavButton label="Back to this month" onClick={() => setView(monthOf(today))}>
              <Icons.reset aria-hidden />
            </NavButton>
            <NavButton label="Previous month" onClick={() => shift(-1)}>
              <Icons.chevronLeft aria-hidden />
            </NavButton>
            <NavButton label="Next month" onClick={() => shift(1)}>
              <Icons.chevronRight aria-hidden />
            </NavButton>
          </div>
        </div>

        <div ref={gridRef} role="grid" aria-label={fmtMonth(first, "long")} className="grid grid-cols-7 gap-y-0.5">
          <div role="row" className="contents">
            {WEEKDAYS.map(([short, long], col) => (
              <div
                key={short}
                role="columnheader"
                aria-label={long}
                className={cn("flex h-6 items-center text-label-mono normal-case text-text-secondary", align(col))}
              >
                {short}
              </div>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div key={w} role="row" className="contents">
              {week.map((date, col) => {
                const isStart = date === draft.from
                const isEnd = date === end
                const isEdge = isStart || isEnd
                const inRange = !!draft.from && !!end && date >= draft.from && date <= end
                const outside = monthOf(date).m !== view.m
                return (
                  <div key={date} role="gridcell" aria-selected={inRange}>
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === tabStop ? 0 : -1}
                      onClick={() => pickDay(date)}
                      onKeyDown={(e) => onKeyDown(e, date)}
                      aria-label={dayLabel(date)}
                      aria-current={date === today ? "date" : undefined}
                      className={cn(
                        "relative isolate flex h-9 w-full cursor-pointer items-center rounded-md font-medium text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                        /* The range band behind the row, and the square on top of it. */
                        "before:absolute before:inset-y-0 before:start-0 before:end-0 before:-z-10 after:absolute after:inset-0.5 after:-z-10 after:rounded-md",
                        align(col),
                        inRange && !(isStart && isEnd) && "before:bg-input-filled",
                        isStart && "before:start-1/2",
                        isEnd && "before:end-1/2",
                        isEdge
                          ? "text-btn-primary-fg after:bg-btn-primary"
                          : cn(
                              "hover:after:bg-card hover:after:inset-ring-[1.5px] hover:after:inset-ring-foreground",
                              outside ? "text-text-tertiary" : "text-foreground",
                              date === today && "underline decoration-[1.5px] underline-offset-4",
                            ),
                      )}
                    >
                      {Number(date.slice(8))}
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <span aria-live="polite" className="ps-2.5 font-medium text-text-secondary text-xs">
            {picking ? "Pick the end day" : days != null ? plural(days, "day") : "Pick the start day"}
          </span>
          <Button type="button" variant="primary" size="sm" disabled={!canApply} onClick={apply}>
            Apply
          </Button>
        </div>
      </div>

      {presets.length ? (
        <div
          role="group"
          aria-label="Presets"
          className={cn(
            "flex gap-1.5 border-border-subtle p-4",
            stacked
              ? "flex-row flex-wrap border-t"
              : "w-39 flex-col border-s max-sm:w-auto max-sm:flex-row max-sm:flex-wrap max-sm:border-s-0 max-sm:border-t",
          )}
        >
          {presets.map(([preset, label]) => (
            <button
              key={preset}
              type="button"
              aria-pressed={draft.preset === preset}
              onClick={() => pickPreset(preset)}
              className="h-8 cursor-pointer whitespace-nowrap rounded-full border border-transparent bg-input-filled px-3.5 text-foreground text-label-lg outline-none hover:border-border-hover focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-btn-primary aria-pressed:text-btn-primary-fg"
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/* The start or end of the draft, read-only: the calendar sets it. */
function RangeEnd({ label, value }: { label: string; value: string | null }) {
  return (
    <input
      readOnly
      aria-label={label}
      placeholder={label}
      value={value ? fmtDate(value) : ""}
      className="h-8 w-full min-w-0 rounded-lg bg-input-filled px-2.5 text-label-lg text-text-figure tabular-nums outline-none placeholder:text-text-tertiary focus-visible:ring-[1.5px] focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    />
  )
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-grid size-7 cursor-pointer place-items-center rounded-md text-foreground outline-none hover:bg-input-filled focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&_svg]:size-4"
    >
      {children}
    </button>
  )
}
