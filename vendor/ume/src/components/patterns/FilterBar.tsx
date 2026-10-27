import * as React from "react"
import { useIsMobileNav } from "../../hooks/use-media-query"
import { Icons, type Icon } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Drawer, DrawerFooter, DrawerHeader, DrawerPanel, DrawerPopup, DrawerTitle } from "../ui/drawer"
import { IconChip, type ChipHue } from "./IconChip"

/* The row of filter pills over a list or a chart (Ledger's Overview and
   Transactions, Figma 67:1205). On a desktop each pill opens its own
   picker: a period picker, a ChoiceMenu (key | value), a FilterMenu (name
   and count). Once something is on, a black "Clear all" pill ends the row.

   Below lg the row folds into one Filters sheet so the header never
   overflows at 375px: the pills (or a Filters button with a count) open a
   bottom drawer with every choice as a section, "Clear filters" and Done.

   The bar holds no filter state: the app passes the pills, the sheet's
   sections, how many filters are on and what Clear does. */

/* The phone's trigger: an outline button, its adjust icon in the brand
   colour and, once filters are on, their count in a round badge. */
export function FiltersButton({
  count = 0,
  children = "Filters",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & { count?: number; children?: string }) {
  return (
    <Button
      variant="outline"
      aria-label={count ? `${children}, ${count} on` : children}
      {...props}
    >
      <Icons.adjust className="text-primary" />
      {children}
      {count ? (
        <span
          aria-hidden
          className="-me-1.5 grid size-5 place-items-center rounded-full bg-primary text-label-mono text-primary-foreground tabular-nums"
        >
          {count}
        </span>
      ) : null}
    </Button>
  )
}

/* "Clear all": a black pill the filter pills' size. Show it only while a
   filter is on. */
export function FilterClear({ children = "Clear all", className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="primary" size="sm" className={cn("rounded-full text-label-lg", className)} {...props}>
      {children}
    </Button>
  )
}

/* One choice in the Filters sheet: an icon chip and a heading, then the
   picker. `id` names the heading, for a radio group's aria-labelledby. */
export function FilterSection({
  icon,
  hue = "blue",
  title,
  id,
  className,
  children,
}: {
  icon: Icon | React.ReactNode
  hue?: ChipHue
  title: string
  id?: string
  className?: string
  children: React.ReactNode
}) {
  const auto = React.useId()
  const headingId = id ?? `${auto}-heading`
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-3", className)}>
      <h3 id={headingId} className="flex items-center gap-2.5 font-medium text-sm">
        <IconChip icon={icon} hue={hue} size="sm" />
        {title}
      </h3>
      {children}
    </section>
  )
}

/* The bottom drawer behind the phone's pills. Each section applies on its
   own (a choice as soon as it's tapped, a date range on its Apply); Done
   only closes. "Clear filters" is off until something is on. */
export function FilterSheet({
  open,
  onOpenChange,
  title = "Filters",
  count = 0,
  onClear,
  clearLabel = "Clear filters",
  doneLabel = "Done",
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  count?: number
  onClear?: () => void
  clearLabel?: string
  doneLabel?: string
  children: React.ReactNode
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} position="bottom">
      <DrawerPopup showBar>
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className="flex flex-col gap-6">{children}</DrawerPanel>
        <DrawerFooter>
          {onClear ? (
            <Button variant="ghost" type="button" size="lg" disabled={!count} onClick={onClear}>
              {clearLabel}
            </Button>
          ) : null}
          <Button type="button" size="lg" className="flex-1" onClick={() => onOpenChange(false)}>
            {doneLabel}
          </Button>
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  )
}

export function FilterBar({
  children,
  sheet,
  phoneTrigger,
  count = 0,
  onClear,
  phone,
  title = "Filters",
  clearLabel = "Clear filters",
  doneLabel = "Done",
  className,
}: {
  /* The desktop row: the period picker first, then ChoiceMenus,
     FilterMenus and a FilterClear while something is on. */
  children: React.ReactNode
  /* The phone's Filters sheet: one FilterSection per choice. Without it
     the row shows at every width. */
  sheet?: React.ReactNode
  /* What opens the sheet on a phone (the same pills, with onClick={open});
     a FiltersButton with the count by default. */
  phoneTrigger?: (open: () => void, expanded: boolean) => React.ReactNode
  /* How many filters are on: the Filters button's badge, and it turns on
     the sheet's "Clear filters". */
  count?: number
  /* What "Clear filters" in the sheet does. */
  onClear?: () => void
  /* Force a layout; by default it follows the app shell (phone below lg). */
  phone?: boolean
  title?: string
  clearLabel?: string
  doneLabel?: string
  className?: string
}) {
  const narrow = useIsMobileNav()
  const [open, setOpen] = React.useState(false)
  const folded = Boolean(sheet) && (phone ?? narrow)
  const show = () => setOpen(true)

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {folded ? (
        <>
          {phoneTrigger ? (
            phoneTrigger(show, open)
          ) : (
            <FiltersButton count={count} onClick={show} aria-haspopup="dialog" aria-expanded={open}>
              {title}
            </FiltersButton>
          )}
          <FilterSheet
            open={open}
            onOpenChange={setOpen}
            title={title}
            count={count}
            onClear={onClear}
            clearLabel={clearLabel}
            doneLabel={doneLabel}
          >
            {sheet}
          </FilterSheet>
        </>
      ) : (
        children
      )}
    </div>
  )
}
