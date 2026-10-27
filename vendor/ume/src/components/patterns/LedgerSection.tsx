import * as React from "react"
import { Button } from "../ui/button"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { CountBadge, LedgerSearch } from "./parts"

/* The frame around every open ledger list (Transactions, People,
   Subscriptions, and the tables in Settings): the title with its count,
   one row with the filter pills on the left and the search on the right,
   then the table (or the phone list), then the pages of 25. */

export const LEDGER_PAGE = 25

/* The heading: the title and the row count in its small circle. */
export function LedgerTitle({ id, children, count }: { id?: string; children: React.ReactNode; count: number }) {
  return (
    <h2 id={id} className="flex items-center gap-2 font-medium text-lg text-text-figure">
      {children}
      <CountBadge count={count} />
    </h2>
  )
}

/* The tools row: filter pills (scroll sideways on a phone) and, on the
   right, the search or the section's buttons. */
export function LedgerTools({ filters, end }: { filters?: React.ReactNode; end?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 max-sm:overflow-x-auto max-sm:pb-0.5">{filters}</div>
      {end}
    </div>
  )
}

/* The table search. On a phone it starts as a round 28px icon beside the
   filter pills and opens into the field on its own line; it stays open
   while something is typed in. */
export function SearchField({
  value,
  onChange,
  compact,
  label,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  compact: boolean
  label: string
  placeholder: string
}) {
  const [open, setOpen] = React.useState(false)
  const inputWrap = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (open) inputWrap.current?.querySelector("input")?.focus()
  }, [open])
  if (compact && !open && !value) {
    return (
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen(true)}
        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border border-border-subtle bg-canvas text-icon-muted outline-none hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4"
      >
        <Icons.search aria-hidden />
      </button>
    )
  }
  return (
    <div
      ref={inputWrap}
      className={cn(compact ? "w-full" : "w-70 max-w-full")}
      onBlur={(e) => {
        if (compact && !value && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <LedgerSearch value={value} onChange={onChange} label={label} placeholder={placeholder} className="w-full" />
    </div>
  )
}

/* "1–25 of 80 · Page 1 of 4 ‹ ›", shown once there is more than a page. */
export function LedgerPager({
  page,
  total,
  pageSize = LEDGER_PAGE,
  onPage,
  className,
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
  className?: string
}) {
  if (total <= pageSize) return null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 pt-1 text-text-secondary text-xs sm:px-6", className)}>
      <span className="tabular-nums">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icons.chevronLeft aria-hidden />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <Icons.chevronRight aria-hidden />
        </Button>
      </span>
    </div>
  )
}

/* Pages of a list: the current page (clamped) and its rows. */
export function usePaged<T>(rows: T[], pageSize = LEDGER_PAGE) {
  const [page, setPage] = React.useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages)
  return {
    page: current,
    setPage,
    pageRows: rows.slice((current - 1) * pageSize, current * pageSize),
  }
}

/* The empty state inside a ledger: a line and, when filters or a search
   narrowed it, a button that clears them. */
export function LedgerEmpty({
  message,
  onClear,
  clearLabel = "Clear search and filters",
}: {
  message: string
  onClear?: () => void
  clearLabel?: string
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-text-secondary">{message}</p>
      {onClear ? (
        <Button variant="secondary" size="md" onClick={onClear}>
          {clearLabel}
        </Button>
      ) : null}
    </div>
  )
}
