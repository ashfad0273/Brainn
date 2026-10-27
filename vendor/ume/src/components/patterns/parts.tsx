import * as React from "react"
import { MINUS } from "../../lib/format"
import { HUE_CLASSES, initials, type Hue } from "../../lib/hue"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { ColumnResizeHandle, type ResizableColumns } from "../ui/resizable-columns"

/* The parts of the open ledger table (Figma 67:1205), shared by the
   Overview's Recent activity and the Transactions page so the two never
   drift: the sortable mono header, the 48px cell, the zebra row with the
   selected look, the 12px row check, the category tag and the signed
   amount.

   The selected row takes the sidebar's selected look (a fade from
   --sidebar-active and a 1px line on the left). That fade is the approved
   sidebar gradient, so this file is on check-conventions' no-gradient
   allowlist. */

export type SortDir = "ascending" | "descending"

/* "25 Oct 2026", read as a local date like fmtDate. */
const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" })
export function fmtRowDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return DATE_FMT.format(new Date(y, m - 1, d))
}

/* The scroller around a ledger table: thin scrollbar that shows on hover
   or while scrolling.
   `relative`: screen-reader-only text in the cells is positioned, and must
   stay inside this scroller on phones. */
export const ledgerScroller = "relative overflow-x-auto pb-1.5 thin-scrollbar autohide-scrollbar"

/* A header cell. With `onSort` it is a button that sorts by it (aria-sort
   says how); with `columns` + `index` it carries the resize handle. */
export function LedgerHead({
  label,
  sort = "none",
  onSort,
  columns,
  index,
  first = false,
  numeric = false,
  className,
  children,
}: {
  label: string
  sort?: SortDir | "none"
  onSort?: () => void
  columns?: ResizableColumns
  index?: number
  first?: boolean
  /* A column of numbers: the header sits on the end edge, over its figures. */
  numeric?: boolean
  className?: string
  children?: React.ReactNode
}) {
  return (
    <th
      scope="col"
      aria-sort={onSort ? sort : undefined}
      className={cn(
        "relative h-12 whitespace-nowrap border-border-subtle border-b px-3 text-start text-label-mono text-text-secondary",
        first && "ps-4",
        numeric && "text-end",
        className,
      )}
    >
      {children ??
        (onSort ? (
          <button
            type="button"
            onClick={onSort}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2 py-2.5 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              sort !== "none" && "text-foreground",
            )}
          >
            {label}
            <Icons.sort aria-hidden className="size-4 text-icon-muted" />
          </button>
        ) : (
          <span className="inline-flex px-2 py-2.5">{label}</span>
        ))}
      {columns && index !== undefined ? (
        <ColumnResizeHandle columns={columns} index={index} label={label} />
      ) : null}
    </th>
  )
}

/* A body cell: 48px, Body Medium, ellipsis when the column is narrower.
   `numeric` right-aligns it, so figures of different lengths share one edge
   (with the tabular digits set on html, every place lines up). */
export function LedgerCell({
  first = false,
  numeric = false,
  className,
  children,
  ...props
}: { first?: boolean; numeric?: boolean } & React.ComponentProps<"td">) {
  return (
    <td
      className={cn(
        "h-12 overflow-hidden text-ellipsis whitespace-nowrap border-border-subtle/60 border-b px-5 font-medium text-sm",
        first && "ps-6",
        numeric && "text-end",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

/* The zebra row; `selected` swaps the stripe for the sidebar's selected
   look. */
export function ledgerRow(selected = false, className?: string): string {
  return cn(
    "odd:bg-row-stripe even:bg-row-stripe-alt hover:bg-[color-mix(in_srgb,var(--card)_60%,var(--row-stripe))]",
    selected &&
      "odd:bg-transparent even:bg-transparent bg-[linear-gradient(90deg,var(--sidebar-active)_50%,transparent)] hover:bg-[linear-gradient(90deg,var(--sidebar-active)_50%,transparent)] [&>td:first-child]:shadow-[inset_1px_0_0_var(--icon-default)]",
    className,
  )
}

/* The design's 12px square check: hairline on the card, icon-default fill
   with a card-coloured tick when on. */
export function RowCheck({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: () => void
  label: string
}) {
  const ref = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={cn(
        "relative inline-grid size-3 cursor-pointer appearance-none place-content-center rounded-check border border-border-subtle bg-card align-middle outline-none transition-colors duration-fast",
        "checked:border-(--icon-default) checked:bg-(--icon-default) indeterminate:border-(--icon-default) indeterminate:bg-(--icon-default)",
        "checked:after:h-0.75 checked:after:w-1.5 checked:after:-translate-y-px checked:after:-rotate-45 checked:after:border-card checked:after:border-b-[1.5px] checked:after:border-s-[1.5px] checked:after:content-['']",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    />
  )
}

/* A category as a soft tag in its hue (neutral when it has none). The app
   decides the hue; Ledger maps each category to one with useCategoryHue. */
export function CategoryTag({ category, hue, className }: { category: string; hue?: Hue | null; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center truncate rounded-md px-2 text-xs",
        hue ? [HUE_CLASSES[hue].soft, HUE_CLASSES[hue].ink] : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {category}
    </span>
  )
}

/* A signed amount: "+ ৳1,20,000" in the money-in purple, "− ৳45,000" in neg, no sign and the
   figure colour for a transfer seen across all accounts (sign 0). */
export function AmountText({
  sign,
  children,
  className,
}: {
  sign: number
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        sign > 0 ? "text-money-in" : sign < 0 ? "text-neg" : "text-foreground",
        className,
      )}
    >
      {sign > 0 ? "+ " : sign < 0 ? `${MINUS} ` : null}
      {children}
    </span>
  )
}

/* The row count in a small pill beside a table's heading (and beside each
   option in a filter menu): Plex Sans on the field grey, no border. */
export function CountBadge({ count, label, className }: { count: number; label?: string; className?: string }) {
  return (
    <span
      aria-label={label ?? `${count} shown`}
      className={cn(
        "inline-grid h-5.5 min-w-5.5 place-items-center rounded-full bg-field px-1.5 font-medium text-text-figure text-xs tabular-nums",
        className,
      )}
    >
      {count}
    </span>
  )
}

/* The compact table search: a 32px filled field with the search icon. */
export function LedgerSearch({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  className?: string
}) {
  return (
    <label
      className={cn(
        "flex h-8 w-70 min-w-0 shrink items-center gap-1.5 rounded-md bg-row-stripe px-2.5 transition-shadow duration-fast focus-within:ring-[1.5px] focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-card",
        className,
      )}
    >
      <Icons.search aria-hidden className="size-4 shrink-0 text-icon-muted" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="min-w-0 flex-1 border-0 bg-transparent font-medium text-foreground text-sm outline-none placeholder:text-text-tertiary"
      />
    </label>
  )
}

/* A row's 28px square icon button: a muted icon that lifts to white with a
   hairline on hover (on the grey page). */
export const rowIconButton =
  "inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-md border border-transparent bg-transparent text-icon-muted outline-none hover:bg-card hover:text-foreground hover:shadow-[0_0_0_1px_var(--border-subtle),var(--button-shadow)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4"

/* The destructive one (sign out a device): the icon in red ink, no fill at
   rest, the soft red behind it on hover and focus. */
export const rowIconButtonDestructive =
  "inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-neg-ink outline-none hover:bg-neg-soft focus-visible:bg-neg-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4"

export function RowIconButton({
  label,
  onClick,
  destructive = false,
  className,
  children,
}: {
  label: string
  onClick: () => void
  destructive?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(destructive ? rowIconButtonDestructive : rowIconButton, className)}
    >
      {children}
    </button>
  )
}

/* A name with its initials: a 28px neutral circle (a square for a company
   or a tool) in Label Mono, then the name, one line. People, Subscriptions
   and Activity. */
export function NameCell({
  name,
  shown = name,
  square = false,
}: {
  name: string
  /* What the cell reads (People shows one name); the initials use `name`. */
  shown?: string
  square?: boolean
}) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2.5">
      <span
        aria-hidden
        className={cn(
          "inline-grid size-7 shrink-0 place-items-center border border-border-subtle bg-card text-label-mono text-foreground",
          square ? "rounded-md" : "rounded-full",
        )}
      >
        {initials(name)}
      </span>
      <span className="truncate">{shown}</span>
    </span>
  )
}

/* A soft status tag in the table: green for good (Active, Done), red for
   attention (Failed, overdue), orange for very soon, amber
   (yellow) for soon, neutral otherwise. */
export function StatusTag({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "good" | "bad" | "warn" | "soon" | "neutral"
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-xs [&_svg]:size-3.5",
        tone === "good"
          ? "bg-pos-soft text-pos-ink"
          : tone === "bad"
            ? "bg-neg-soft text-neg-ink"
            : tone === "warn"
              ? "bg-orange-soft text-orange-ink"
              : tone === "soon"
                ? "bg-amber-soft text-amber-ink"
                : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

/* A tag in one of the hue palettes (Team violet, Client blue, "This device"). */
export function HueTag({ hue, children }: { hue: Hue; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center rounded-md px-2 text-xs", HUE_CLASSES[hue].soft, HUE_CLASSES[hue].ink)}>
      {children}
    </span>
  )
}

/* A month row's total on its hue's soft fill, "Received: ৳180K": the label
   regular, the figure semibold. Transactions (Income, Expenses) and Projects
   (Total projects, Received, Due, Cancelled) share it. */
export function MonthPill({ hue, label, children }: { hue: Hue; label: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-3 font-normal text-xs", HUE_CLASSES[hue].soft, HUE_CLASSES[hue].ink)}>
      {label}
      <span className="font-(--weight-semibold) tabular-nums">{children}</span>
    </span>
  )
}

/* One name for a list cell: the first word, without a trailing comma or
   full stop ("Figma, Inc." → "Figma", "Rafi Ahmed" → "Rafi"). The full name
   stays in the hover title and the side panel. */
export const oneName = (n: string): string => (n.trim().split(/\s+/)[0] ?? n).replace(/[,.]+$/, "")
