/* The real minus sign (U+2212) for negative figures, never a hyphen. */
export const MINUS = "\u2212"

/* Locale-aware date; parses YYYY-MM-DD as local to avoid a UTC off-by-one. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const p = String(iso).split("-").map(Number)
  const d =
    p.length === 3 && p[0] && p[1] && p[2]
      ? new Date(p[0], p[1] - 1, p[2])
      : new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d)
}

/* Date and time without seconds: "Oct 2, 2026, 3:00 AM". Seconds are noise in
   an activity log or a backup list. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

/* A log time for the ledger tables (Activity, Backups): "04 Oct, 15:30",
   with the year only when it isn't this year ("28 Dec 2025, 21:00"). */
const STAMP_DAY = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" })
const STAMP_DAY_YEAR = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
const STAMP_TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
export function fmtStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const day = d.getFullYear() === new Date().getFullYear() ? STAMP_DAY : STAMP_DAY_YEAR
  return `${day.format(d)}, ${STAMP_TIME.format(d)}`
}

/* A month label in the viewer's locale. Takes a Date, a "YYYY-MM" key or a
   "YYYY-MM-DD" date (read as local, like fmtDate).
   "short" -> "Oct" (chart axes, calendar strips)
   "long"  -> "October 2026" (headings, month groups) */
export function fmtMonth(date: Date | string, style: "short" | "long" = "long"): string {
  let d: Date
  if (date instanceof Date) d = date
  else {
    const [y, m] = String(date).split("-").map(Number)
    d = y && m ? new Date(y, m - 1, 1) : new Date(date)
  }
  if (Number.isNaN(d.getTime())) return String(date)
  return new Intl.DateTimeFormat(
    undefined,
    style === "short" ? { month: "short" } : { month: "long", year: "numeric" },
  ).format(d)
}

/* Weekday and day of month, "Wed 12", for rows under a month heading where
   the month is already on screen. Reads "YYYY-MM-DD" as local, like fmtDate. */
export function fmtDay(iso: string): string {
  const [y, m, d] = String(iso).split("-").map(Number)
  const date = y && m && d ? new Date(y, m - 1, d) : new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric" }).format(date)
}

/* created_by stores the operator's full name, or their email when the profile
   has no name — show just the first name (email local part as fallback). */
export const firstName = (name: string) => {
  const base = (name.includes("@") ? name.split("@")[0] : name).trim()
  const first = base.split(/\s+/)[0] || name
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?"

/* Strict decimal parse — strips thousands separators, rejects anything that
   doesn't fully parse (parseFloat would truncate "1,200" to 1). Commas only
   between digits ("1,500", "1,50,000"), so ",5", "5," and "1,,5" are refused. */
export const parseStrict = (s: string): number | null => {
  const t = s.trim()
  return /^\d+(,\d+)*(\.\d+)?$/.test(t) ? parseFloat(t.replace(/,/g, "")) : null
}

/* Local date parts, not toISOString() (UTC) — keeps the default entry date in
   sync with the local-time period/bucket math above. */
export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

/* Counted nouns as whole templated strings, one per plural category, instead of
   a fragment concatenated around a variable. Word order and plural rules differ
   by language, so `{n} entry` / `{n} entries` stay editable as complete
   sentences — the precondition for ever localising this app.

   count(3, "{n} entry", "{n} entries") -> "3 entries" */
export function count(n: number, one: string, other: string): string {
  return (n === 1 ? one : other).replace("{n}", String(n))
}

/* Shorthand for a count followed by a noun that pluralises with "s" (or the
   plural you pass): plural(1, "result") -> "1 result",
   plural(1200, "entry", "entries") -> "1,200 entries". */
export function plural(n: number, one: string, other = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : other}`
}
