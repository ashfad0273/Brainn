import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { cn } from "../../lib/utils"
import { Icons } from "../../lib/icons"
import { ScrollArea } from "../ui/scroll-area"

/* The side panel (Transactions, approved Oct 2026): a panel from the right
   over a soft scrim, the whole screen on a phone. Tags and the title on top
   with the round close button, a scrolling body, and the buttons at the
   foot (the destructive one on the left). Esc, the X and the scrim close
   it. Used for a transaction, a person, a subscription and a backup.

   The body is one block (figure, notes, details) just under the header;
   `aside` is a second block below the body's only hairline (similar
   transactions). The header and footer lines show only once content
   scrolls under them, and the scrollbar only while scrolling.

   `item` drives it: null closes it, and the last item stays on screen
   while the panel slides out. */
export function SidePanel<T extends { id: string | number }>({
  item,
  onClose,
  render,
}: {
  item: T | null
  onClose: () => void
  render: (item: T) => {
    tags?: React.ReactNode
    title: React.ReactNode
    body: React.ReactNode
    aside?: React.ReactNode
    footer?: React.ReactNode
  }
}) {
  const [shown, setShown] = React.useState<T | null>(item)
  if (item && item !== shown) setShown(item)
  const current = item ?? shown
  const view = current ? render(current) : null

  return (
    <DialogPrimitive.Root open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-[color-mix(in_srgb,var(--foreground)_18%,transparent)] transition-opacity duration-base ease-out data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Popup className="group/panel fixed inset-y-0 end-0 z-50 flex w-full max-w-[460px] flex-col border-border-subtle border-s bg-card pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-pop outline-none transition-[translate,opacity] duration-base ease-out data-ending-style:translate-x-6 data-ending-style:opacity-0 data-starting-style:translate-x-6 data-starting-style:opacity-0">
          {current && view ? (
            <>
              <div className="flex items-start justify-between gap-3 border-transparent border-b pt-5 pb-4 ps-6 pe-5 transition-[border-color] duration-fast group-has-[[data-slot=panel-body][data-overflow-y-start]]/panel:border-border-subtle">
                <div className="flex min-w-0 flex-col items-start gap-2">
                  {view.tags ? <div className="flex flex-wrap items-center gap-1.5">{view.tags}</div> : null}
                  <DialogPrimitive.Title className="font-medium text-lg text-text-figure">{view.title}</DialogPrimitive.Title>
                </div>
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-border-subtle bg-card text-foreground shadow-button outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card [&_svg]:size-4"
                >
                  <Icons.close aria-hidden />
                </DialogPrimitive.Close>
              </div>
              {/* Keyed by the item, so a new one opens scrolled to the top. */}
              <ScrollArea key={current.id} data-slot="panel-body" scrollbarOnScroll className="flex-1">
                <div className="flex flex-col gap-6 px-6 pt-1 pb-6">{view.body}</div>
                {view.aside ? <div className="border-border-subtle border-t px-6 py-8">{view.aside}</div> : null}
              </ScrollArea>
              {/* Wraps on phones, where three actions (Subscriptions) overflow. */}
              {view.footer ? (
                <div className="flex flex-wrap items-center justify-end gap-2 border-transparent border-t px-6 py-4 transition-[border-color] duration-fast group-has-[[data-slot=panel-body][data-overflow-y-end]]/panel:border-border-subtle">
                  {view.footer}
                </div>
              ) : null}
            </>
          ) : null}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* Label-over-value details, three to a row (two on a phone), no rules
   between them: a grey medium label over a regular value. A wide item
   takes the full width. */
export function DetailGrid({ items }: { items: Array<{ label: string; value: React.ReactNode; wide?: boolean }> }) {
  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-5 max-[480px]:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className={cn("flex min-w-0 flex-col items-start gap-1", it.wide && "col-span-full")}>
          <dt className="font-medium text-text-secondary text-xs">{it.label}</dt>
          <dd className="max-w-full wrap-anywhere text-foreground text-sm">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/* A small rounded note under the panel's figure: "Archived · …",
   "Renews 14 Mar · in 5 months", "No October salary saved yet". */
export function PanelNote({
  icon,
  tone = "neutral",
  children,
}: {
  icon: React.ReactNode
  tone?: "neutral" | "rose" | "amber"
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 self-start rounded-full px-2.5 text-xs [&_svg]:size-3.5",
        tone === "rose"
          ? "bg-neg-soft text-neg-ink"
          : tone === "amber"
            ? "bg-amber-soft text-amber-ink"
            : "bg-input-filled text-text-secondary",
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/* "None" in the disabled colour, for an empty detail or cell. */
export function NoneText({ children = "None" }: { children?: React.ReactNode }) {
  return <span className="text-text-disabled">{children}</span>
}
