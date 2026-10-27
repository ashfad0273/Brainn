import type * as React from "react"
import { type ChipHue, IconChip } from "./IconChip"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../ui/empty"
import { type Icon, Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* The app's empty states used to be one-line `<div className="py-14 text-center
   …">` literals in a dozen places, at three different vertical rhythms, while
   ui/empty.tsx shipped with zero imports. One of them lived inside ClientBars,
   so two unrelated widgets imported a shared component from a chart module.

   This wraps the primitive with the app's defaults so a caller supplies only
   what changes: a title, optionally a line of orientation, optionally one
   action. An empty state that offers no next step is the thing the copy guide
   calls a dead end — `action` is the reason this component exists.

   Vibrant: every empty state leads with a 48px hue chip (solid brand blue
   unless a `hue` is given), then a one-line title, one line of help and one
   primary action. A page's first-run state can trade the chip for a Hairline
   illustration (src/components/illustrations), 288px wide, 320 from sm.

   Rhythm: 24px from the chip or drawing to the title, 8px from the title to
   its help, 24px to the action, so the words read as one group and the
   action as the next step. The title is Title (17px) over Body (15px) help.
   Both are centred, so both balance: the help wraps to lines of near-equal
   length, no wider than 40 characters (standard.md §2, Line length). */

export function EmptyState({
  title,
  description,
  icon = Icons.empty,
  hue = "brand",
  illustration,
  action,
  className,
}: {
  title: string
  description?: string
  /* An Icons.* component (or element). Defaults to an inbox. */
  icon?: Icon | React.ReactNode
  hue?: ChipHue
  /* An Illustration, shown in place of the icon chip. */
  illustration?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <Empty className={cn("gap-6 py-12 md:py-12", className)}>
      <EmptyHeader>
        {illustration ? (
          /* A Hairline figure draws in a 400×320 frame with air under the
             drawing (the Projects canvas ends at 245, leaving 18.75% of the
             width). The negative margin takes that air back so the drawing
             itself sits 24px over the title: 16px of margin + the 8px gap. */
          <div className="-mb-9.5 w-72 max-w-full sm:-mb-11 sm:w-80">{illustration}</div>
        ) : (
          <IconChip icon={icon} hue={hue} size="lg" className="mb-4" />
        )}
        <EmptyTitle className="text-balance font-medium text-foreground text-lg">{title}</EmptyTitle>
        {description ? (
          <EmptyDescription className="max-w-[40ch] text-balance">{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
