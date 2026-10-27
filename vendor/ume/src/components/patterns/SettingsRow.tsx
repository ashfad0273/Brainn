import type * as React from "react"
import { Label } from "../ui/label"
import { CountBadge } from "./parts"
import { cn } from "../../lib/utils"

/* The open settings layout (Settings, approved Oct 2026): no cards. A
   section is a head (the title, a one-line description, an optional count
   and a button on the right) over its rows; a row is the label and help on
   the left and the control on the right, with hairlines between rows. A tab
   with one section leaves out the title (the tab already names it); the
   head then holds only the action, if there is one. */

export function SettingsSection({
  id,
  title,
  description,
  count,
  countLabel,
  action,
  className,
  children,
}: {
  id?: string
  title?: React.ReactNode
  description?: React.ReactNode
  /* A count in the small circle beside the title. */
  count?: number
  countLabel?: string
  /* A button on the right of the head. */
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn(
        "flex min-w-0 max-w-250 flex-col",
        /* No head: the first row's rule would sit right under the tab bar. */
        !title && !action && "[&_[data-settings-rows]>:first-child]:border-t-0",
        className,
      )}
    >
      {title || action ? (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
          {title ? (
            <div className="min-w-0 flex-1 basis-72">
              <h2 id={id} className="flex items-center gap-2 font-medium text-lg text-text-figure">
                {title}
                {count !== undefined ? <CountBadge count={count} label={countLabel} /> : null}
              </h2>
              {description ? (
                <p className="mt-1 max-w-[60ch] text-pretty text-sm text-text-secondary">{description}</p>
              ) : null}
            </div>
          ) : null}
          {action ? (
            <div className={cn("flex shrink-0 items-center gap-2", !title && "ms-auto")}>{action}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/* For a ledger table inside a settings tab (Devices, Activity, Backups): the
   first column starts 12px in, so the zebra rows run to the section's edges
   while the text lines up close to the heading above. */
export const settingsTable = "[&_td:first-child]:ps-3 [&_th:first-child]:ps-1"

/* A phone list inside a settings tab runs to the screen's edges, like the
   Transactions list. */
export const settingsBleed = "-mx-4 sm:-mx-6"

/* A stack of SettingsRows: a hairline above each row and under the last. */
export function SettingsRows({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-settings-rows className={cn("flex flex-col", className)}>
      {children}
    </div>
  )
}

/* One setting: label and help on the left, the control on the right.
   `htmlFor` ties the label to a single control; `labelId` names a group of
   controls (aria-labelledby) instead; `helpId` lets a control point at the
   help (aria-describedby). `leading` sits before the label (an icon tile).
   `below` sits under the help.

   A compact control (a switch, a segmented control, a picker, a button)
   stays beside the label on phones too: the label gives way first. A field
   takes its own full-width line under the label on phones. `inline` forces
   one line at every width. */
export function SettingsRow({
  label,
  htmlFor,
  labelId,
  help,
  helpId,
  below,
  leading,
  inline = false,
  children,
  className,
}: {
  label: React.ReactNode
  htmlFor?: string
  labelId?: string
  help?: React.ReactNode
  helpId?: string
  below?: React.ReactNode
  leading?: React.ReactNode
  inline?: boolean
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-border-subtle/60 border-t py-4 last:border-b sm:gap-x-8",
        inline && "flex-nowrap",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 basis-32 items-center gap-3 sm:basis-60">
        {leading}
        <div className="min-w-0 flex-1">
          {htmlFor ? (
            /* px-0: Label's own inset would push it right of the help line. */
            <Label htmlFor={htmlFor} id={labelId} className="flex px-0 font-medium text-sm">
              {label}
            </Label>
          ) : (
            <span id={labelId} className="block font-medium text-sm">
              {label}
            </span>
          )}
          {help ? (
            <p id={helpId} className="mt-0.5 text-pretty text-text-secondary text-xs">
              {help}
            </p>
          ) : null}
          {below}
        </div>
      </div>
      {children ? (
        <div className="ms-auto flex min-w-0 max-w-full flex-col items-end gap-1.5 max-sm:has-[[data-slot=input-control]]:w-full max-sm:has-[[data-slot=input-control]]:items-stretch">
          {children}
        </div>
      ) : null}
    </div>
  )
}
