import type * as React from "react"

/* The shapes the app shell takes. Ume holds no app data: the app builds
   these from its own routes, auth and data, and passes them to AppShell. */

/* A 16px glyph a row colours through currentColor: the solid page icons in
   lib/nav-icons, or any Icons.* entry. */
export type ShellIcon = React.ComponentType<{ className?: string; "aria-hidden"?: React.AriaAttributes["aria-hidden"] }>

/* The selected row's accent: the line, icon and fade of a nav row, set
   through data-nav-accent in ume.css. No accent keeps the black default. */
export type NavAccent = "blue" | "violet" | "amber" | "rose" | "green"

/* A sub-page, listed under its parent and indented to the parent's label. */
export type NavChild = {
  path: string
  label: string
}

/* One page in the sidebar and the phone menu. `path` is matched against the
   shell's `currentPath` to find the open page, and turned into the link's
   href by `hrefFor`. A parent with `children` links to its first child. */
export type NavItem = {
  path: string
  label: string
  icon: ShellIcon
  accent?: NavAccent
  children?: readonly NavChild[]
}

/* Who is signed in: the sidebar header and the phone menu's top line. */
export type ShellUser = {
  name: string
  /* A short role, e.g. "Admin": the account menu's label and the phone
     menu's second line. */
  role?: string
  /* The workspace or organisation, under the name. */
  workspace?: string
}

/* An extra row in the account menu (and, unless `inPhoneMenu` is false, the
   phone menu), listed before Change password. */
export type ShellAction = {
  label: string
  icon?: ShellIcon
  onSelect: () => void
  destructive?: boolean
  /* Also list it in the phone menu. */
  inPhoneMenu?: boolean
}

/* What a nav link receives. Spread it onto the router's own link; the
   default is a plain <a> that calls `onNavigate` on a normal click. */
export type ShellLinkProps = {
  href: string
  className: string
  children: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
  "aria-current"?: "page"
  "data-nav-accent"?: NavAccent
}

/* ok: under `due` · due: up to `stale` · stale: after that · empty: never. */
export type SyncState = "ok" | "due" | "stale" | "empty"

export type SyncPillProps = {
  /* When the data last changed or synced; null when it never has. */
  at: Date | null
  /* Holds a neutral pill until the first load lands. */
  loading?: boolean
  /* The clock to measure from. Defaults to the current time, refreshed
     every minute. */
  now?: Date
  /* The visible line before "12 mins ago". */
  label?: string
  /* The line when `at` is null. */
  emptyLabel?: string
  /* The line while loading. */
  loadingLabel?: string
  /* The hover title before the exact time. */
  exactLabel?: string
  /* What a screen reader hears after the line, per state. */
  statusLabels?: Partial<Record<SyncState, string>>
  /* Milliseconds after which the dot turns amber (`due`) and rose (`stale`). */
  thresholds?: { due: number; stale: number }
  className?: string
}

/* The sync pill in the sidebar foot and the phone menu: SyncPill's props. */
export type ShellSync = Omit<SyncPillProps, "className">

/* responsive: the sidebar from lg up, the phone menu below it.
   phone / desktop: always that layout, whatever the width (a preview, or
   an app inside a narrow frame). */
export type ShellLayout = "responsive" | "phone" | "desktop"

/* Every word the shell itself shows, so an app can change any of them. */
export type ShellLabels = {
  skipToContent: string
  /* The sidebar's nav landmark. */
  nav: string
  /* The phone menu's nav landmark. */
  phoneNav: string
  /* Read before the name on the sidebar header. */
  accountMenu: string
  /* The account menu's label, before the role. */
  signedIn: string
  changePassword: string
  signOut: string
  switchToLight: string
  switchToDark: string
  theme: string
  light: string
  dark: string
  /* The phone menu button and the menu itself. */
  menu: string
  closeMenu: string
}

/* What AppShell (or ShellProvider) takes and its parts read. */
export type ShellConfig = {
  /* The pages, in order. Filter out what the person can't open first. */
  nav: readonly NavItem[]
  /* The current pathname, e.g. location.pathname. */
  currentPath: string
  /* Turns a nav path into the link's href, e.g. to carry a query string. */
  hrefFor?: (path: string) => string
  /* Whether a nav path is the open page. Defaults to an exact match for
     "/" and a segment-prefix match for the rest. */
  isActive?: (path: string, currentPath: string) => boolean
  /* Draws a nav link with the app's router. */
  renderLink?: (props: ShellLinkProps) => React.ReactNode
  /* Called with the href on a normal click of the default <a> link. */
  onNavigate?: (href: string) => void
  /* The mark at the top of the sidebar and the phone top bar. */
  logo?: React.ReactNode
  user?: ShellUser
  accountActions?: readonly ShellAction[]
  /* Adds Change password to both menus. The app opens its own dialog. */
  onChangePassword?: () => void
  /* Adds Sign out to both menus. */
  onSignOut?: () => void
  /* Adds the light / dark switch to both menus. */
  themeSwitch?: boolean
  /* Shows the sync pill in the sidebar foot and the phone menu. */
  sync?: ShellSync
  /* The sidebar's last row. */
  credit?: React.ReactNode
  /* The phone menu's foot, beside the sync pill. */
  phoneCredit?: React.ReactNode
  /* The phone top bar's round + button. Null or absent: no button. */
  addAction?: { label: string; onSelect: () => void } | null
  layout?: ShellLayout
  labels?: Partial<ShellLabels>
}
