import type * as React from "react"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* The round filter pills from the Overview (Figma 67:1205): 28px, fully
   round, a hairline border.

   - SegmentedPill: a key segment (icon + "Date" on the canvas grey) and a
     value segment ("This month" in the figure colour). One button, so the
     whole pill is one target and one name for a screen reader.
   - SoloPill: just the key segment ("Filter").

   Both pass every other prop through to the <button>, so they work as the
   `render` element of a Popover or Menu trigger. */

const pillBase =
  "group inline-flex h-7 shrink-0 cursor-pointer items-stretch overflow-hidden rounded-full border border-border-subtle bg-card text-label-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-icon-muted"

/* Pills follow the button rule: 10px each side, 2px less (8px) on the side
   with the icon. */
const keySeg =
  "inline-flex items-center gap-1 bg-canvas ps-2 pe-2.5 text-btn-ghost-fg group-hover:bg-background"

export function SegmentedPill({
  icon,
  label,
  value,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <button type="button" className={cn(pillBase, className)} {...props}>
      <span className={cn(keySeg, "border-border-subtle border-e")}>
        {icon}
        {label}
      </span>
      <span className="inline-flex max-w-48 items-center px-2.5 text-text-figure group-hover:bg-background">
        <span className="truncate">{value}</span>
      </span>
    </button>
  )
}

export function SoloPill({
  icon,
  label,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  icon: React.ReactNode
  label: React.ReactNode
}) {
  return (
    <button type="button" className={cn(pillBase, className)} {...props}>
      <span className={cn(keySeg, "group-aria-expanded:text-foreground")}>
        {icon}
        <span className="max-w-40 truncate">{label}</span>
      </span>
    </button>
  )
}

/* A filter pill: its name, a count once something is picked, and a chevron
   (Transactions' Category / Person / Added by). The chevron side gets the
   8px. The count is a 14px dot 2px from the label, the chevron's size. */
export function FilterPill({
  label,
  count = 0,
  className,
  ...props
}: React.ComponentProps<"button"> & { label: string; count?: number }) {
  return (
    <button type="button" className={cn(pillBase, className)} {...props}>
      <span
        className={cn(
          keySeg,
          "gap-1.5 ps-2.5 pe-2 group-aria-expanded:text-foreground",
          count > 0 && "text-text-figure",
        )}
      >
        {label}
        {count > 0 ? (
          <span className="-ms-1 inline-grid h-3.5 min-w-3.5 place-items-center rounded-full bg-btn-primary px-1 text-btn-primary-fg text-pill-count tabular-nums">
            {count}
          </span>
        ) : null}
        <Icons.chevronDown aria-hidden />
      </span>
    </button>
  )
}
