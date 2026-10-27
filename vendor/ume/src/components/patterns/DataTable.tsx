import * as React from "react"
import { cn } from "../../lib/utils"
import { ResizableColGroup, useResizableColumns } from "../ui/resizable-columns"
import { LedgerCell, LedgerHead, ledgerRow, ledgerScroller, type SortDir } from "./parts"

/* The open ledger table for any list of records (People, Subscriptions,
   Devices, Activity, Backups), built from the same parts as the
   Transactions table and the Overview's Recent activity: mono sortable
   headers with resize handles, 48px zebra rows, ellipsis cells, a row that
   opens a side panel, and the row's icon buttons in the last column. On a
   phone the same rows read as a LedgerList. */

export interface LedgerColumn<T> {
  key: string
  label: string
  cell: (row: T) => React.ReactNode
  /* A full value for the hover title when the cell may be cut off. */
  title?: (row: T) => string | null | undefined
  sortable?: boolean
  /* Money, counts, hours, rates: header and cells align to the end edge.
     check-conventions `numeric-column` asks for it on columns named so. */
  numeric?: boolean
}

export function DataTable<T>({
  storageKey,
  rows,
  columns,
  rowKey,
  rowLabel,
  sort,
  onSort,
  onOpen,
  actions,
  empty,
  minWidth = 860,
}: {
  /* Column widths persist per table under this key. */
  storageKey: string
  rows: T[]
  columns: LedgerColumn<T>[]
  rowKey: (row: T) => string
  rowLabel: (row: T) => string
  sort?: { key: string; dir: SortDir }
  onSort?: (key: string) => void
  onOpen?: (row: T, from: HTMLElement) => void
  /* The row's buttons (Edit, Delete, …); the column is left out without it. */
  actions?: (row: T) => React.ReactNode
  empty: React.ReactNode
  minWidth?: number
}) {
  const tableRef = React.useRef<HTMLTableElement>(null)
  /* Column changes (a tile hides one) start from fresh widths. */
  const columnsKey = columns.map((c) => c.key).join(".")
  const resizable = useResizableColumns(tableRef, `${storageKey}:${columnsKey}`)
  const colCount = columns.length + (actions ? 1 : 0)

  return (
    <div className={ledgerScroller}>
      <table
        key={columnsKey}
        ref={tableRef}
        style={{ ...resizable.tableStyle, minWidth }}
        className="w-full border-collapse"
      >
        <ResizableColGroup columns={resizable} />
        <thead>
          <tr>
            {columns.map((c, i) => (
              <LedgerHead
                key={c.key}
                label={c.label}
                first={i === 0}
                numeric={c.numeric}
                sort={sort?.key === c.key ? sort.dir : "none"}
                onSort={c.sortable !== false && onSort ? () => onSort(c.key) : undefined}
                columns={resizable}
                index={i}
              />
            ))}
            {actions ? (
              <LedgerHead label="Actions">
                <span className="sr-only">Actions</span>
              </LedgerHead>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r) => {
              return (
                <tr
                  key={rowKey(r)}
                  tabIndex={onOpen ? 0 : undefined}
                  aria-label={onOpen ? `Open ${rowLabel(r)}` : undefined}
                  onClick={onOpen ? (ev) => onOpen(r, ev.currentTarget) : undefined}
                  onKeyDown={
                    onOpen
                      ? (ev) => {
                          if (ev.target === ev.currentTarget && (ev.key === "Enter" || ev.key === " ")) {
                            ev.preventDefault()
                            onOpen(r, ev.currentTarget)
                          }
                        }
                      : undefined
                  }
                  className={ledgerRow(
                    false,
                    onOpen ? "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset" : undefined,
                  )}
                >
                  {columns.map((c, i) => (
                    <LedgerCell key={c.key} first={i === 0} numeric={c.numeric} title={c.title?.(r) ?? undefined}>
                      {c.cell(r)}
                    </LedgerCell>
                  ))}
                  {actions ? (
                    <LedgerCell className="px-3">
                      <span className="flex items-center gap-1">{actions(r)}</span>
                    </LedgerCell>
                  ) : null}
                </tr>
              )
            })
          ) : (
            <tr>
              <td colSpan={colCount} className="h-40 px-4 text-center">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* The same rows on a phone: one zebra row each, the main line on top, the
   details under it, a figure on the right. A tap opens the side panel. */
export function LedgerList<T>({
  rows,
  rowKey,
  label,
  render,
  onOpen,
  empty,
}: {
  rows: T[]
  rowKey: (row: T) => string
  label: string
  render: (row: T) => { top: React.ReactNode; meta?: React.ReactNode; end?: React.ReactNode }
  onOpen?: (row: T, from: HTMLElement) => void
  empty: React.ReactNode
}) {
  if (!rows.length) return <div className="px-4 py-10 text-center">{empty}</div>
  return (
    <ul aria-label={label}>
      {rows.map((r) => {
        const v = render(r)
        const inner = (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-center gap-2 font-medium text-sm">{v.top}</span>
              {v.meta ? <span className="truncate text-text-secondary text-xs">{v.meta}</span> : null}
            </span>
            {v.end ? <span className="shrink-0 whitespace-nowrap font-medium text-sm">{v.end}</span> : null}
          </>
        )
        const rowClass = "flex w-full items-center gap-3 border-border-subtle/60 border-b px-4 py-3 text-start"
        return (
          <li key={rowKey(r)} className="odd:bg-row-stripe even:bg-row-stripe-alt">
            {onOpen ? (
              <button
                type="button"
                onClick={(ev) => onOpen(r, ev.currentTarget)}
                className={cn(rowClass, "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset")}
              >
                {inner}
              </button>
            ) : (
              <div className={rowClass}>{inner}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/* Sorting helper for the lists above: empty values last either way, ties by
   the fallback (usually the name). */
export function compareBy<T>(
  a: T,
  b: T,
  pick: (row: T) => string | number | null | undefined,
  dir: SortDir,
  tie: (a: T, b: T) => number,
): number {
  const av = pick(a)
  const bv = pick(b)
  const ae = av == null || av === ""
  const be = bv == null || bv === ""
  if (ae && !be) return 1
  if (be && !ae) return -1
  if (!ae && !be) {
    const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))
    if (c) return dir === "ascending" ? c : -c
  }
  return tie(a, b)
}

/* Next sort state for a header click: same column flips, a new one starts
   in its natural direction (numbers and dates high first). */
export function nextSort(
  prev: { key: string; dir: SortDir },
  key: string,
  descFirst: (key: string) => boolean = () => false,
): { key: string; dir: SortDir } {
  if (prev.key === key) return { key, dir: prev.dir === "ascending" ? "descending" : "ascending" }
  return { key, dir: descFirst(key) ? "descending" : "ascending" }
}
