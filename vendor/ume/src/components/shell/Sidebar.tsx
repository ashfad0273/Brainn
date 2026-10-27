import * as React from "react"
import { useTheme } from "../../hooks/use-theme"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { SquidxLogo } from "../brand/SquidxLogo"
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu"
import { byLayout, hrefOf, isNavActive, ShellLink, useShell } from "./context"
import { SyncPill } from "./SyncPill"

/* The desktop sidebar, built to the approved design (Figma node 30:1537):
   220px wide and as tall as the viewport (or the shell, when contained), on
   --sidebar with its right edge drawn as an inset --sidebar-border hairline.

   - Top (24px gap): the header (logo, name, workspace) is the account menu
     trigger, then the pages from the shell's `nav`.
   - Bottom (16px gap): the sync pill and the credit row, when given.

   The selected row's surface fades out to the right. That fade is one of the
   two gradients the designer approved, so this file is on check-conventions'
   GRADIENT_ALLOWLIST; nothing else here may add one. Hidden below lg (in the
   responsive layout), where the page top bar's menu (PhoneMenu) takes over.
   Reads everything from the AppShell around it; renders nothing outside one. */

/* Focus: a 2px --ring outline drawn 4px inside the row (or 2px inside the
   header), so it never clips against the sidebar edge. */
const FOCUS = "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ring"

export function Sidebar({ className }: { className?: string }): React.ReactElement | null {
  const shell = useShell()
  if (!shell || shell.layout === "phone") return null
  const hasFoot = Boolean(shell.sync || shell.credit)

  return (
    <aside
      className={cn(
        shell.contained ? "h-full" : "sticky top-0 h-dvh",
        "w-55 shrink-0 flex-col justify-between gap-5 overflow-y-auto bg-sidebar py-5 shadow-[inset_-1px_0_0_var(--sidebar-border)]",
        byLayout(shell.layout, { responsive: "hidden lg:flex", desktop: "flex", phone: "hidden" }),
        className,
      )}
    >
      <div className="flex flex-col gap-6">
        <SidebarHeader />
        <SidebarNav label={shell.labels.nav} />
      </div>
      {hasFoot ? (
        <div className="flex flex-col gap-4">
          {shell.sync ? (
            <div className="flex h-10.5 items-center px-5">
              <SyncPill {...shell.sync} />
            </div>
          ) : null}
          {shell.credit ? (
            <div className="flex h-10.5 items-center px-5 font-medium text-sm text-text-secondary whitespace-nowrap">
              {shell.credit}
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}

/* The header doubles as the account menu: the app's own rows, Change
   password, the theme switch and Sign out, behind one quiet trigger. No
   chrome of its own; the workspace line brightens on hover and while open.
   Without a user it is the logo alone. */
function SidebarHeader(): React.ReactElement | null {
  const shell = useShell()
  const { theme, toggle } = useTheme()
  if (!shell) return null
  const { user, labels } = shell
  const logo = shell.logo ?? <SquidxLogo />

  if (!user) return <div className="flex h-9 items-center px-5">{logo}</div>

  const actions = shell.accountActions ?? []
  const quiet = actions.filter((a) => !a.destructive)
  const loud = actions.filter((a) => a.destructive)
  const hasLoud = loud.length > 0 || Boolean(shell.onSignOut)

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "group/account flex h-9 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-5 text-left focus-visible:-outline-offset-2",
          FOCUS,
        )}
      >
        {logo}
        <span className="flex min-w-0 flex-col gap-0.5 font-medium text-sm leading-4">
          <span className="sr-only">{labels.accountMenu}: </span>
          <span className="truncate text-foreground">{user.name}</span>
          {user.workspace ? (
            <span className="truncate text-text-secondary group-hover/account:text-foreground group-data-popup-open/account:text-foreground">
              {user.workspace}
            </span>
          ) : null}
        </span>
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-56">
        <MenuGroup>
          <MenuGroupLabel>{user.role ? `${labels.signedIn} · ${user.role}` : labels.signedIn}</MenuGroupLabel>
          {quiet.map((a) => (
            <MenuItem key={a.label} onClick={a.onSelect}>
              {a.icon ? <a.icon /> : null}
              {a.label}
            </MenuItem>
          ))}
          {shell.onChangePassword ? (
            <MenuItem onClick={shell.onChangePassword}>
              <Icons.key />
              {labels.changePassword}
            </MenuItem>
          ) : null}
          {shell.themeSwitch ? (
            <MenuItem onClick={toggle}>
              {theme === "dark" ? <Icons.light /> : <Icons.dark />}
              {theme === "dark" ? labels.switchToLight : labels.switchToDark}
            </MenuItem>
          ) : null}
        </MenuGroup>
        {hasLoud ? <MenuSeparator /> : null}
        {loud.map((a) => (
          <MenuItem key={a.label} variant="destructive" onClick={a.onSelect}>
            {a.icon ? <a.icon /> : null}
            {a.label}
          </MenuItem>
        ))}
        {shell.onSignOut ? (
          <MenuItem variant="destructive" onClick={shell.onSignOut}>
            <Icons.signOut />
            {labels.signOut}
          </MenuItem>
        ) : null}
      </MenuPopup>
    </Menu>
  )
}

/* A nav row: the selected surface and bar fade in rather than swap; hover
   switches the text and icon colour instantly. */
function rowClass(height: string, selected: boolean): string {
  return cn(
    "group/nav relative isolate flex items-center gap-2 rounded-sm px-5 font-medium text-sm focus-visible:-outline-offset-4",
    height,
    FOCUS,
    "before:absolute before:inset-x-0 before:inset-y-0.75 before:-z-10 before:bg-[linear-gradient(90deg,var(--nav-fade)_50%,transparent)] before:opacity-0 before:transition-opacity before:duration-fast",
    "after:absolute after:inset-y-0.75 after:left-0 after:w-px after:bg-nav-accent after:opacity-0 after:transition-opacity after:duration-fast",
    selected ? "text-foreground before:opacity-100 after:opacity-100" : "text-text-secondary hover:text-foreground",
  )
}

/* The rows, in `nav` order: 42px, a 16px icon and a 15px Medium label.
   Unselected: --text-secondary with an --icon-muted icon; hover lifts them to
   the default text colour and --icon-secondary. Selected: default text, on a
   surface fading from --nav-fade (inset 3px top and bottom) with a 1px
   --nav-accent bar on the left edge and the icon in --nav-accent. Those two
   default to --sidebar-active and --icon-default (black); an item with an
   `accent` overrides them via data-nav-accent (ume.css).
   An item with `children` lists them under it, indented to its label; the
   open child takes the selected surface and the parent keeps its accent icon.
   PhoneMenu reuses it with 48px rows (`tall`) and closes on a pick. */
export function SidebarNav({
  label,
  tall = false,
  onNavigate,
}: {
  /* The nav landmark's name. Defaults to the shell's `labels.nav`. */
  label?: string
  /* 48px rows (44px for sub-pages), for touch. */
  tall?: boolean
  /* Called on any pick, e.g. to close a menu. */
  onNavigate?: () => void
}): React.ReactElement | null {
  const shell = useShell()
  if (!shell) return null

  return (
    <nav aria-label={label ?? shell.labels.nav}>
      <ul className="flex list-none flex-col">
        {shell.nav.map((item) => {
          const active = isNavActive(shell, item.path)
          const children = item.children ?? []
          const parentSelected = active && !children.length
          return (
            <li key={item.path}>
              <ShellLink
                href={hrefOf(shell, children[0]?.path ?? item.path)}
                aria-current={parentSelected ? "page" : undefined}
                data-nav-accent={item.accent}
                onClick={onNavigate}
                className={cn(rowClass(tall ? "h-12" : "h-10.5", parentSelected), active && "text-foreground")}
              >
                <item.icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-nav-accent" : "text-icon-muted group-hover/nav:text-icon-secondary",
                  )}
                />
                {item.label}
              </ShellLink>
              {children.length ? (
                <ul className="flex list-none flex-col" aria-label={item.label}>
                  {children.map((child) => {
                    const on = isNavActive(shell, child.path)
                    return (
                      <li key={child.path}>
                        {/* Indented to the parent's label: 20px gutter + 16px icon + 8px gap. */}
                        <ShellLink
                          href={hrefOf(shell, child.path)}
                          aria-current={on ? "page" : undefined}
                          data-nav-accent={item.accent}
                          onClick={onNavigate}
                          className={cn(rowClass(tall ? "h-11" : "h-9", on), "ps-11")}
                        >
                          {child.label}
                        </ShellLink>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
