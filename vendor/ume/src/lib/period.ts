/* Periods: a named window ("This month") or a custom range of days, and the
   date maths the period picker and any report need. No app data here: an app
   filters its own rows with periodRange().

   "1d" today · "ld" yesterday · "1w" this week (Monday to Sunday) · "lw"
   last week · "1m" this month · "lm" last month · "3m" this month and the two
   before · "ytd" this calendar year · "ly" last calendar year · "all"
   everything. A custom range is a pair of inclusive YYYY-MM-DD bounds, kept
   in a URL as "from..to" (serializePeriod / parsePeriod).

   Dates are local YYYY-MM-DD strings throughout, never toISOString() (UTC),
   so a window's edges match the dates people typed. */

export type PeriodPreset = "1d" | "ld" | "1w" | "lw" | "1m" | "lm" | "3m" | "ytd" | "ly" | "all"
export type CustomRange = { from: string; to: string }
export type Period = PeriodPreset | CustomRange

/* A preset as the picker lists it: its id and the words on its chip. */
export type PeriodPresetOption = readonly [preset: PeriodPreset, label: string]

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  "1d": "Today",
  ld: "Yesterday",
  "1w": "This week",
  lw: "Last week",
  "1m": "This month",
  lm: "Last month",
  "3m": "3 months",
  ytd: "This year",
  ly: "Last year",
  all: "All time",
}

/* Presets with their standard labels, in the order given. */
export const presetOptions = (ids: readonly PeriodPreset[]): PeriodPresetOption[] =>
  ids.map((v) => [v, PRESET_LABELS[v]] as const)

/* The chips the period picker shows unless told otherwise. */
export const PICKER_PRESETS: readonly PeriodPresetOption[] = presetOptions([
  "1d",
  "ld",
  "1w",
  "lw",
  "1m",
  "lm",
  "ytd",
  "ly",
])

const PRESET_IDS = new Set<string>(Object.keys(PRESET_LABELS))

export const isPreset = (p: Period): p is PeriodPreset => typeof p === "string"

/* --- Day maths ----------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, "0")

/* A local Date → "YYYY-MM-DD". */
export const isoOf = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/* "YYYY-MM-DD" → a local Date (midnight). */
export const parseIso = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const todayIso = (): string => isoOf(new Date())

/* n days from a date (negative for earlier). */
export const addDays = (s: string, n: number): string => {
  const d = parseIso(s)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

/* The same day of the month n months away, clamped to that month's last day
   (31 January + 1 month → 28 or 29 February). */
export const addMonths = (s: string, n: number): string => {
  const d = parseIso(s)
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()
  return isoOf(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last)))
}

/* 0 for Monday … 6 for Sunday: weeks start on Monday. */
export const weekdayIndex = (s: string): number => (parseIso(s).getDay() + 6) % 7

/* A date's year and month (0–11). */
export const monthOf = (s: string): { y: number; m: number } => ({
  y: Number(s.slice(0, 4)),
  m: Number(s.slice(5, 7)) - 1,
})

/* Days in an inclusive range: the same day twice is 1. */
export const daysInRange = (from: string, to: string): number =>
  Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000) + 1

/* Whole calendar months a range touches: 3 March to 2 May is 3. */
export const monthsInRange = (from: string, to: string): number => {
  const a = monthOf(from)
  const b = monthOf(to)
  return Math.max(1, (b.y - a.y) * 12 + (b.m - a.m) + 1)
}

/* Six full weeks (42 dates) from the Monday on or before the 1st of a month:
   the days a month calendar shows. */
export function monthGrid(y: number, m: number): string[] {
  const lead = (new Date(y, m, 1).getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => isoOf(new Date(y, m, i - lead + 1)))
}

/* --- Windows --------------------------------------------------------------- */

/* Every preset is a closed calendar window: "This week" is Monday through
   Sunday, "This month" the 1st through its last day, so a date next month is
   never in it. Month arithmetic goes through the Date constructor (day 0 is
   the last day of the month before), which handles year wrap and short
   months. "all" has no bounds and returns null. */
function presetRange(preset: PeriodPreset, now: Date): CustomRange | null {
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()
  const monday = d - ((now.getDay() + 6) % 7)
  switch (preset) {
    case "1d":
      return { from: isoOf(now), to: isoOf(now) }
    case "ld":
      return { from: isoOf(new Date(y, m, d - 1)), to: isoOf(new Date(y, m, d - 1)) }
    case "1w":
      return { from: isoOf(new Date(y, m, monday)), to: isoOf(new Date(y, m, monday + 6)) }
    case "lw":
      return { from: isoOf(new Date(y, m, monday - 7)), to: isoOf(new Date(y, m, monday - 1)) }
    case "1m":
      return { from: isoOf(new Date(y, m, 1)), to: isoOf(new Date(y, m + 1, 0)) }
    case "lm":
      return { from: isoOf(new Date(y, m - 1, 1)), to: isoOf(new Date(y, m, 0)) }
    case "3m":
      return { from: isoOf(new Date(y, m - 2, 1)), to: isoOf(new Date(y, m + 1, 0)) }
    case "ytd":
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    case "ly":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case "all":
      return null
  }
}

/* The inclusive window a period covers, as YYYY-MM-DD bounds, or null for
   "all". Filter rows with it: `date >= range.from && date <= range.to`. */
export function periodRange(period: Period, now: Date = new Date()): CustomRange | null {
  return isPreset(period) ? presetRange(period, now) : period
}

/* Whether a date falls in a period ("all" holds every date). */
export function inPeriod(date: string, period: Period, now: Date = new Date()): boolean {
  const range = periodRange(period, now)
  return !range || (date >= range.from && date <= range.to)
}

/* A preset's name, or a range as its two dates ("2026-10-01 – 2026-10-14");
   the picker's trigger shows a range with fmtDate (PeriodTriggerLabel). */
export function periodLabel(p: Period): string {
  return isPreset(p) ? PRESET_LABELS[p] : `${p.from} – ${p.to}`
}

const RANGE_RE = /^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/

/* A period for a URL: the preset id, or "from..to". */
export function serializePeriod(p: Period): string {
  return isPreset(p) ? p : `${p.from}..${p.to}`
}

/* The reverse of serializePeriod; null for anything it doesn't recognise. A
   range given backwards is put the right way round. */
export function parsePeriod(s: string | null | undefined): Period | null {
  if (!s) return null
  if (PRESET_IDS.has(s)) return s as PeriodPreset
  const m = RANGE_RE.exec(s)
  if (!m) return null
  const [, from, to] = m
  return from <= to ? { from, to } : { from: to, to: from }
}

/* The window just before a period, for period-over-period changes; null for
   "all". Month presets map to the same span of calendar months before, "Last
   year" to the year before it, and "This year" to last year up to the same
   day, so a part-year never meets a whole one. A day, a week or a custom
   range maps to a window of the same length ending the day before it
   starts. */
export function previousPeriod(period: Period, now: Date = new Date()): CustomRange | null {
  if (period === "all") return null
  const y = now.getFullYear()
  const m = now.getMonth()
  if (period === "1m") return { from: isoOf(new Date(y, m - 1, 1)), to: isoOf(new Date(y, m, 0)) }
  if (period === "lm") return { from: isoOf(new Date(y, m - 2, 1)), to: isoOf(new Date(y, m - 1, 0)) }
  if (period === "3m") return { from: isoOf(new Date(y, m - 5, 1)), to: isoOf(new Date(y, m - 2, 0)) }
  if (period === "ytd") {
    /* 29 February compares against 28 February. */
    const lastDay = new Date(y - 1, m + 1, 0).getDate()
    return { from: `${y - 1}-01-01`, to: isoOf(new Date(y - 1, m, Math.min(now.getDate(), lastDay))) }
  }
  if (period === "ly") return { from: `${y - 2}-01-01`, to: `${y - 2}-12-31` }
  const range = periodRange(period, now)
  if (!range) return null
  const span = daysInRange(range.from, range.to)
  const to = addDays(range.from, -1)
  return { from: addDays(to, -(span - 1)), to }
}
