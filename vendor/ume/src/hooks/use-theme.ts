import * as React from "react"

/* Same localStorage key as the old app; public/theme-init.js applies it
   before first paint, and follows the OS when the key is absent. So
   "system" is stored as no key at all. */
const THEME_KEY = "sl-theme"

export type Theme = "light" | "dark"
export type ThemePreference = Theme | "system"

const DARK_QUERY = "(prefers-color-scheme: dark)"

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === "light" || v === "dark" ? v : "system"
  } catch {
    return "system"
  }
}

function systemTheme(): Theme {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches
    ? "dark"
    : "light"
}

function resolve(pref: ThemePreference): Theme {
  return pref === "system" ? systemTheme() : pref
}

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark")
  document.documentElement.style.colorScheme = t
  const m = document.querySelector('meta[name=theme-color]')
  if (m) {
    /* Read the token rather than repeating it — the hardcoded pair that used to
       live here had drifted from --background in both themes. */
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue("--background")
      .trim()
    // allow-raw-hex: last-resort fallback if the token hasn't resolved yet
    m.setAttribute("content", bg || (t === "dark" ? "#070709" : "#f7f7f7"))
  }
}

/* One module-level store, so the sidebar toggle, the phone menu and the
   Settings control stay in step instead of each holding its own copy. */
let preference: ThemePreference =
  typeof window === "undefined" ? "system" : readPreference()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function setPreference(next: ThemePreference) {
  preference = next
  try {
    if (next === "system") localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, next)
  } catch {
    /* private mode etc. — the choice still applies for this visit */
  }
  applyTheme(resolve(next))
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  /* While following the OS, flip with it. */
  const mql = window.matchMedia(DARK_QUERY)
  const onChange = () => {
    if (preference !== "system") return
    applyTheme(systemTheme())
    emit()
  }
  mql.addEventListener("change", onChange)
  return () => {
    listeners.delete(cb)
    mql.removeEventListener("change", onChange)
  }
}

/* Snapshot is a string so useSyncExternalStore can compare by value. */
const snapshot = () => `${preference}:${resolve(preference)}`
const serverSnapshot = () => "system:light"

export function useTheme() {
  const snap = React.useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const [pref, resolved] = snap.split(":") as [ThemePreference, Theme]
  /* The quick toggle picks the opposite of what's on screen, leaving
     "system" for an explicit choice. */
  const toggle = React.useCallback(() => {
    setPreference(resolve(preference) === "dark" ? "light" : "dark")
  }, [])
  return { theme: resolved, preference: pref, setPreference, toggle }
}
