import * as React from "react"
import { cn } from "../../lib/utils"
import type { SyncPillProps, SyncState } from "./types"

/* The "Last sync" pill at the foot of the sidebar and the phone menu: a
   card-white pill, 24px tall, holding a 6px status dot and a 13px Medium
   line. The dot is --icon-success under a day, --icon-warning from one to
   three days and --icon-danger after that (the thresholds are a prop); the
   same status is spoken through an sr-only suffix, and the exact time sits
   in the title. What "sync" means is the app's call: it passes the time. */

export type { SyncPillProps, SyncState } from "./types"

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const SYNC_THRESHOLDS = { due: DAY, stale: 3 * DAY } as const

const DOT: Record<SyncState, string> = {
  ok: "bg-icon-success",
  due: "bg-icon-warning",
  stale: "bg-icon-danger",
  empty: "bg-icon-muted",
}

const STATUS: Record<SyncState, string> = {
  ok: "up to date",
  due: "due",
  stale: "out of date",
  empty: "not synced yet",
}

const EXACT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

/* Milliseconds since `at`, never negative (a clock a little ahead of the
   server would otherwise read as the future). */
function elapsed(at: Date, now: Date): number {
  return Math.max(0, now.getTime() - at.getTime())
}

/* ok under `due` · due up to and including `stale` · stale after · empty
   when there is no time. */
export function syncState(
  at: Date | null,
  now: Date,
  thresholds: { due: number; stale: number } = SYNC_THRESHOLDS,
): SyncState {
  if (!at) return "empty"
  const ms = elapsed(at, now)
  if (ms < thresholds.due) return "ok"
  if (ms <= thresholds.stale) return "due"
  return "stale"
}

/* "just now", "1 min ago", "12 mins ago", "1 hour ago", "5 hours ago",
   "yesterday", "4 days ago". */
export function syncAgo(at: Date, now: Date): string {
  const ms = elapsed(at, now)
  const mins = Math.floor(ms / MINUTE)
  if (mins < 1) return "just now"
  if (mins < 60) return mins === 1 ? "1 min ago" : `${mins} mins ago`
  const hours = Math.floor(ms / HOUR)
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`
  const days = Math.floor(ms / DAY)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/* The current time, refreshed every minute so "12 mins ago" keeps moving.
   Off when the caller passes its own clock. */
function useNow(enabled: boolean, intervalMs = MINUTE): Date {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [enabled, intervalMs])
  return now
}

export function SyncPill({
  at,
  loading = false,
  now: nowProp,
  label = "Last sync",
  emptyLabel = "Not synced yet",
  loadingLabel = "Checking…",
  exactLabel = "Last synced",
  statusLabels,
  thresholds = SYNC_THRESHOLDS,
  className,
}: SyncPillProps): React.ReactElement {
  const ticking = useNow(nowProp === undefined)
  const now = nowProp ?? ticking
  const state: SyncState = loading ? "empty" : syncState(at, now, thresholds)
  const status = { ...STATUS, ...statusLabels }
  const text = loading ? loadingLabel : at ? `${label} ${syncAgo(at, now)}` : emptyLabel
  return (
    <span
      data-state={loading ? "loading" : state}
      title={at && !loading ? `${exactLabel} ${EXACT.format(at)}` : undefined}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-full bg-card px-3 font-medium text-foreground text-xs whitespace-nowrap",
        className,
      )}
    >
      <i aria-hidden className={cn("size-1.5 shrink-0 rounded-full transition-colors duration-fast", DOT[state])} />
      <span className="truncate">
        {text}
        {!loading && at ? <span className="sr-only">, {status[state]}</span> : null}
      </span>
    </span>
  )
}
