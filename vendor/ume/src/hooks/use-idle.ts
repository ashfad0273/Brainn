import * as React from "react"

/* Inactivity: after `limitMs` with no pointer, key, scroll or touch, run
   `onIdle` (sign out). During the final `warnMs` it returns the `deadline`
   (epoch ms) for IdleWarning to count down to; activity, or `stay()`, clears
   it. First built for Squidx Ledger's 15-minute sign-out.

   With `storageKey`, the last activity is shared through localStorage, so
   activity in any tab keeps every tab signed in. Writes are throttled to one
   every 10 seconds; the clock is read every `checkEveryMs`.

   Coming back to the tab counts as activity, but only after the clock is
   read: timers don't run while a laptop sleeps or a phone suspends the tab,
   so a session that ran out while away goes idle there instead of being
   revived.

   `idleNow()` is the warning's "Sign out now": it runs onIdle straight away,
   once, and the timer won't run it again. `onIdle` is read through a ref, so
   a new function each render doesn't restart the clock. */

const WRITE_THROTTLE_MS = 10_000

export function useIdle({
  limitMs,
  warnMs = 60_000,
  checkEveryMs = 10_000,
  storageKey,
  onIdle,
  enabled = true,
}: {
  limitMs: number
  warnMs?: number
  checkEveryMs?: number
  /* A localStorage key shared by every tab of the app. */
  storageKey?: string
  onIdle: () => void
  enabled?: boolean
}): {
  /* When the warning should show: the epoch ms the session goes idle. */
  deadline: number | null
  /* "Stay signed in": counts as activity now and clears the warning. */
  stay: () => void
  /* "Sign out now": runs onIdle at once. */
  idleNow: () => void
} {
  const [deadline, setDeadline] = React.useState<number | null>(null)
  const onIdleRef = React.useRef(onIdle)
  onIdleRef.current = onIdle
  /* Set once onIdle has run, by the timer or by idleNow. */
  const fired = React.useRef(false)
  /* The last activity when storage is off or unavailable. */
  const memory = React.useRef(Date.now())

  const write = React.useCallback(
    (now: number) => {
      memory.current = now
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, String(now))
      } catch {
        /* storage unavailable: memory holds it */
      }
    },
    [storageKey],
  )

  const read = React.useCallback((): number => {
    if (!storageKey) return memory.current
    try {
      const raw = Number(localStorage.getItem(storageKey))
      if (Number.isFinite(raw) && raw > 0) return raw
    } catch {
      /* fall through */
    }
    return memory.current
  }, [storageKey])

  React.useEffect(() => {
    if (!enabled) return
    let lastWrite = 0

    const markActive = () => {
      const now = Date.now()
      if (now - lastWrite < WRITE_THROTTLE_MS) return
      lastWrite = now
      write(now)
    }
    /* Seed on mount so a stale value from a previous session can't go idle
       at once. */
    markActive()

    const fire = () => {
      fired.current = true
      setDeadline(null)
      onIdleRef.current()
    }

    const check = () => {
      if (fired.current) return
      const last = read()
      const idle = Date.now() - last
      if (idle >= limitMs) fire()
      else if (idle >= limitMs - warnMs) setDeadline(last + limitMs)
      else setDeadline(null)
    }

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      check()
      if (fired.current) return
      markActive()
      setDeadline(null)
    }

    const events = ["pointermove", "keydown", "click", "scroll", "touchstart"] as const
    for (const ev of events) window.addEventListener(ev, markActive, { passive: true })
    document.addEventListener("visibilitychange", onVisibility)
    const timer = window.setInterval(check, checkEveryMs)

    return () => {
      window.clearInterval(timer)
      for (const ev of events) window.removeEventListener(ev, markActive)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [enabled, limitMs, warnMs, checkEveryMs, read, write])

  const stay = React.useCallback(() => {
    write(Date.now())
    setDeadline(null)
  }, [write])

  const idleNow = React.useCallback(() => {
    if (fired.current) return
    fired.current = true
    setDeadline(null)
    onIdleRef.current()
  }, [])

  return { deadline, stay, idleNow }
}
