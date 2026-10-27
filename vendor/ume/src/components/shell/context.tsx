import * as React from "react"
import type { ShellConfig, ShellLabels, ShellLayout, ShellLinkProps } from "./types"

/* The shell's shared state: what AppShell was given, which the Sidebar, the
   PhoneMenu and every PageTopbar read, so a page's top bar needs no props
   for navigation, the account or the + button. */

export const DEFAULT_SHELL_LABELS: ShellLabels = {
  skipToContent: "Skip to content",
  nav: "Primary",
  phoneNav: "Pages",
  accountMenu: "Account menu",
  signedIn: "Signed in",
  changePassword: "Change password",
  signOut: "Sign out",
  switchToLight: "Switch to light theme",
  switchToDark: "Switch to dark theme",
  theme: "Theme",
  light: "Light",
  dark: "Dark",
  menu: "Menu",
  closeMenu: "Close menu",
}

export type ShellContextValue = Omit<ShellConfig, "labels" | "layout" | "themeSwitch"> & {
  labels: ShellLabels
  layout: ShellLayout
  themeSwitch: boolean
  /* The shell fills its parent instead of the viewport. */
  contained: boolean
  /* Where the phone menu mounts; null mounts it on <body>. */
  portalContainer: HTMLElement | null
}

const ShellContext = React.createContext<ShellContextValue | null>(null)

export type ShellProviderProps = ShellConfig & {
  contained?: boolean
  portalContainer?: HTMLElement | null
  children: React.ReactNode
}

/* AppShell renders this itself. Use it alone only to place a Sidebar or a
   PageTopbar in a layout of your own. */
export function ShellProvider({
  children,
  labels,
  layout = "responsive",
  themeSwitch = true,
  contained = false,
  portalContainer = null,
  ...config
}: ShellProviderProps): React.ReactElement {
  const value: ShellContextValue = {
    ...config,
    labels: { ...DEFAULT_SHELL_LABELS, ...labels },
    layout,
    themeSwitch,
    contained,
    portalContainer,
  }
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

/* The shell around this component, or null outside one. */
export function useShell(): ShellContextValue | null {
  return React.useContext(ShellContext)
}

/* "/" only on itself; any other path on itself and the pages under it. */
export function defaultIsActive(path: string, currentPath: string): boolean {
  if (path === "/") return currentPath === "/"
  const base = path.endsWith("/") ? path.slice(0, -1) : path
  return currentPath === base || currentPath.startsWith(`${base}/`)
}

export function isNavActive(shell: ShellContextValue, path: string): boolean {
  return (shell.isActive ?? defaultIsActive)(path, shell.currentPath)
}

export function hrefOf(shell: ShellContextValue, path: string): string {
  return shell.hrefFor ? shell.hrefFor(path) : path
}

/* One class string per layout: `responsive` switches at lg, the other two
   hold one side whatever the width. */
export function byLayout(layout: ShellLayout, classes: Record<ShellLayout, string>): string {
  return classes[layout]
}

/* A nav link through the app's router, or a plain <a> that hands a normal
   click (no modifier keys, the main button) to `onNavigate`. */
export function ShellLink(props: ShellLinkProps): React.ReactNode {
  const shell = useShell()
  if (shell?.renderLink) return shell.renderLink(props)
  const { href, onClick, children, ...rest } = props
  const onNavigate = shell?.onNavigate
  return (
    <a
      {...rest}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (!onNavigate || event.defaultPrevented) return
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onNavigate(href)
      }}
    >
      {children}
    </a>
  )
}
