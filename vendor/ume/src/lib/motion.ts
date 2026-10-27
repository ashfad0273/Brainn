import * as React from "react"
import { useReducedMotion } from "motion/react"
import type { Transition, Variants } from "motion/react"
import { DURATION, EASE_OUT, SPRING, staggerDelay } from "./ease"

/* Shared motion presets, built from the scale in lib/ease.ts. Consumers must
   gate entrance animations behind useAppReducedMotion(), which honors both the
   OS prefers-reduced-motion setting and the app's own Settings toggle (the
   .reduce-motion class on <html>, applied by lib/prefs.ts — that class only
   zeroes CSS animations, not Motion's JS-driven springs). Never call Motion's
   raw useReducedMotion() in a component: it misses the Settings toggle. */

export function useAppReducedMotion(): boolean {
  const os = useReducedMotion()
  const [appToggle, setAppToggle] = React.useState(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("reduce-motion"),
  )
  React.useEffect(() => {
    const el = document.documentElement
    const observer = new MutationObserver(() =>
      setAppToggle(el.classList.contains("reduce-motion")),
    )
    observer.observe(el, { attributeFilter: ["class"], attributes: true })
    return () => observer.disconnect()
  }, [])
  return Boolean(os) || appToggle
}

/** The one spring (SPRING in lib/ease.ts), typed as a Motion Transition. */
export const spring: Transition = SPRING

/** Entrance: a short rise and fade at the `base` duration. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } },
}

/** Parent variant for list entrances: 20ms between children, and the whole
   cascade capped at 100ms however many children there are (Motion hands the
   function each child's index and the total). */
export const staggerChildren: Variants = {
  hidden: {},
  show: { transition: { delayChildren: (i: number, total: number) => staggerDelay(i, total) } },
}
