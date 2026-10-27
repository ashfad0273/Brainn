import * as React from "react"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { SquidxLogo } from "../brand/SquidxLogo"
import { Button } from "../ui/button"
import { useShell } from "./context"
import { PhoneMenu } from "./PhoneMenu"
import type { ShellLayout } from "./types"

/* The full-bleed page top bar: the title and its one-line subtitle on the
   left, the page's buttons on the right, and an optional second row under
   them. Every page draws its own.

   Where the sidebar is hidden (below lg, or a `phone` shell) the logo leads
   and the page's buttons give way to two 32px secondary icon buttons: + (the
   shell's `addAction`, when it has one) and the menu (PhoneMenu) with every
   page. The subtitle keeps to one line there. Pages whose own buttons do
   something other than the + (keepActionsOnPhone) keep them on phones too,
   beside the two icon buttons. Outside an AppShell there are no icon
   buttons. */

type Parts = {
  row: string
  logo: string
  subtitle: string
  note: string
  actions: string
  phone: string
}

const PARTS: Record<ShellLayout, Parts> = {
  responsive: {
    row: "items-center lg:items-start",
    logo: "lg:hidden",
    subtitle: "mt-0.5 truncate text-xs lg:mt-1 lg:whitespace-normal lg:text-sm",
    note: "max-lg:hidden",
    actions: "hidden lg:flex",
    phone: "flex lg:hidden",
  },
  phone: {
    row: "items-center",
    logo: "",
    subtitle: "mt-0.5 truncate text-xs",
    note: "hidden",
    actions: "hidden",
    phone: "flex",
  },
  desktop: {
    row: "items-start",
    logo: "hidden",
    subtitle: "mt-1 truncate whitespace-normal text-sm",
    note: "",
    actions: "flex",
    phone: "hidden",
  },
}

export function PageTopbar({
  title,
  subtitle,
  note,
  actions,
  keepActionsOnPhone = false,
  hideAdd = false,
  children,
  className,
}: {
  title: React.ReactNode
  /* One line under the title, saying what the page is for. */
  subtitle?: React.ReactNode
  /* A small line under the subtitle, e.g. why a button is off. */
  note?: React.ReactNode
  actions?: React.ReactNode
  /* Show `actions` on phones as well (sized for a phone by the page). */
  keepActionsOnPhone?: boolean
  /* Leave out the shell's + button on this page, e.g. an error page. */
  hideAdd?: boolean
  /* A second row, e.g. a page's date and filter pills. */
  children?: React.ReactNode
  className?: string
}): React.ReactElement {
  const shell = useShell()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const parts = PARTS[shell?.layout ?? "responsive"]
  const logo = shell?.logo ?? <SquidxLogo />

  return (
    <header className={cn("flex flex-col gap-4 border-border-subtle border-b px-4 py-5 sm:px-6", className)}>
      <div className={cn("flex flex-nowrap justify-between gap-4", parts.row)}>
        <div className="flex min-w-0 items-center gap-2.5">
          {parts.logo === "hidden" ? null : <span className={cn("flex shrink-0", parts.logo)}>{logo}</span>}
          <div className="min-w-0">
            <h1 className="truncate font-medium text-lg">{title}</h1>
            {subtitle ? <p className={cn("text-text-secondary", parts.subtitle)}>{subtitle}</p> : null}
            {note ? <div className={keepActionsOnPhone ? undefined : parts.note || undefined}>{note}</div> : null}
          </div>
        </div>
        {actions ? (
          <div className={cn("flex-none items-center gap-2", keepActionsOnPhone ? "flex" : parts.actions)}>{actions}</div>
        ) : null}
        {shell ? (
          <div className={cn("flex-none items-center gap-1.5", parts.phone)}>
            {shell.addAction && !hideAdd ? (
              <Button
                variant="secondary"
                size="md"
                aria-label={shell.addAction.label}
                className="w-8 px-0 [&_svg]:text-foreground"
                onClick={shell.addAction.onSelect}
              >
                <Icons.add aria-hidden />
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="md"
              aria-label={shell.labels.menu}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="w-8 px-0 [&_svg]:text-foreground"
              onClick={() => setMenuOpen(true)}
            >
              <Icons.menu aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>
      {children}
      {shell ? <PhoneMenu open={menuOpen} onOpenChange={setMenuOpen} /> : null}
    </header>
  )
}
