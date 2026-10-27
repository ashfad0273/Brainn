import * as React from "react"
import { type Theme, useTheme } from "../../hooks/use-theme"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { SquidxLogo } from "../brand/SquidxLogo"
import { InitialsAvatar } from "../patterns/IconChip"
import { Button } from "../ui/button"
import { SegmentedControl } from "../ui/segmented-control"
import { Sheet, SheetBackdrop, SheetPortal, SheetPrimitive, SheetViewport } from "../ui/sheet"
import { useShell } from "./context"
import { SidebarNav } from "./Sidebar"
import { SyncPill } from "./SyncPill"

/* The phone menu, opened from the page top bar where the sidebar is hidden.
   It drops from the top on the card: who is signed in, the pages as the
   sidebar's own rows (48px), then Theme (Light / Dark), the app's own rows,
   Change password and Sign out, and at the foot the sync pill and the
   credit. Everything comes from the AppShell around it. When the shell is
   contained, the menu mounts inside it, so it drops within the frame. */

/* Rows match the sidebar rows: 48px, 20px in, a 16px muted icon, grey
   Medium text that lifts on hover (instantly). */
const ROW =
  "flex h-12 w-full items-center gap-2 px-5 text-left font-medium text-sm [&>svg]:size-4 [&>svg]:shrink-0"
const ACTION = cn(
  ROW,
  "cursor-pointer text-text-secondary outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-4 [&>svg]:text-icon-muted",
)
const DESTRUCTIVE = cn(ACTION, "text-neg-ink hover:text-neg-ink [&>svg]:text-neg-ink")

export function PhoneMenu({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.ReactElement | null {
  const shell = useShell()
  const { theme, setPreference } = useTheme()
  if (!shell) return null
  const { user, labels } = shell
  const close = () => onOpenChange(false)
  const themes: { value: Theme; label: string }[] = [
    { value: "light", label: labels.light },
    { value: "dark", label: labels.dark },
  ]
  const actions = (shell.accountActions ?? []).filter((a) => a.inPhoneMenu !== false)
  const second = [user?.role, user?.workspace].filter(Boolean).join(" · ")
  const hasFoot = Boolean(shell.sync || shell.phoneCredit)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetPortal container={shell.portalContainer ?? undefined}>
        <SheetBackdrop className="bg-modal-scrim backdrop-blur-none" />
        <SheetViewport side="top">
          <SheetPrimitive.Popup
            aria-label={labels.menu}
            className="flex max-h-full min-h-0 flex-col rounded-b-3xl border-border-subtle border-b bg-card pt-[env(safe-area-inset-top)] pb-3 text-foreground shadow-pop outline-none transition-[translate,opacity] duration-base ease-out data-ending-style:-translate-y-6 data-ending-style:opacity-0 data-starting-style:-translate-y-6 data-starting-style:opacity-0"
          >
            <div className="flex items-center gap-3 border-border-subtle border-b pt-3 pr-4 pb-4 pl-5">
              {user ? (
                <>
                  <InitialsAvatar name={user.name} size="lg" className="size-10 bg-input-filled text-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-sm text-text-figure">{user.name}</span>
                    {second ? <span className="block truncate text-text-secondary text-xs">{second}</span> : null}
                  </span>
                </>
              ) : (
                <span className="flex min-w-0 flex-1">{shell.logo ?? <SquidxLogo />}</span>
              )}
              <SheetPrimitive.Close
                aria-label={labels.closeMenu}
                render={<Button variant="secondary" size="icon-sm" className="[&_svg]:text-foreground" />}
              >
                <Icons.close aria-hidden />
              </SheetPrimitive.Close>
            </div>

            <div className="min-h-0 overflow-y-auto py-2">
              <SidebarNav label={labels.phoneNav} tall onNavigate={close} />
              <div aria-hidden className="mx-5 my-2 h-px bg-border-subtle" />
              {shell.themeSwitch ? (
                <div role="group" aria-label={labels.theme} className={cn(ROW, "text-text-secondary [&>svg]:text-icon-muted")}>
                  {theme === "dark" ? <Icons.dark aria-hidden /> : <Icons.light aria-hidden />}
                  {labels.theme}
                  <SegmentedControl
                    aria-label={labels.theme}
                    options={themes}
                    value={theme}
                    onValueChange={setPreference}
                    className="ms-auto w-auto"
                  />
                </div>
              ) : null}
              {actions.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className={a.destructive ? DESTRUCTIVE : ACTION}
                  onClick={() => {
                    close()
                    a.onSelect()
                  }}
                >
                  {a.icon ? <a.icon aria-hidden /> : null}
                  {a.label}
                </button>
              ))}
              {shell.onChangePassword ? (
                <button
                  type="button"
                  className={ACTION}
                  onClick={() => {
                    close()
                    shell.onChangePassword?.()
                  }}
                >
                  <Icons.key aria-hidden />
                  {labels.changePassword}
                </button>
              ) : null}
              {shell.onSignOut ? (
                <button type="button" className={DESTRUCTIVE} onClick={shell.onSignOut}>
                  <Icons.signOut aria-hidden />
                  {labels.signOut}
                </button>
              ) : null}
            </div>

            {hasFoot ? (
              <div className="flex items-center justify-between gap-2 px-5 pt-2">
                {shell.sync ? <SyncPill {...shell.sync} className="bg-canvas" /> : <span />}
                {shell.phoneCredit ? <span className="text-text-secondary text-xs">{shell.phoneCredit}</span> : null}
              </div>
            ) : null}
          </SheetPrimitive.Popup>
        </SheetViewport>
      </SheetPortal>
    </Sheet>
  )
}
