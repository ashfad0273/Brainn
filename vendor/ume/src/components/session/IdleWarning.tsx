import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import * as React from "react"
import { Button } from "../ui/button"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* Still there? (M17, approved Oct 2026; first built for Squidx Ledger),
   shown during the final minute before an inactivity sign-out. A centred
   360px card on the modal scrim: a 96px countdown ring (orange on the grey
   track, red for the last 10 seconds) around a 24px clock, the title, one
   line with the time left, and two equal lg buttons, "Sign out now" and
   "Stay signed in". Not the Modal frame: no header row or close button,
   everything centred. It keeps the Modal's scrim, card and motion classes so
   it reads as the same family.

   It is open while `deadline` (epoch ms) is set; useIdle (hooks/use-idle)
   supplies it. Dismissing it by any other means (Esc, the scrim) counts as
   "stay signed in": the person interacted, so they're not idle. */

/* The ring: 96px, a 4px stroke centred on r = 46. */
const SIZE = 96
const STROKE = 4
const R = (SIZE - STROKE) / 2
const CIRC = 2 * Math.PI * R

export interface IdleWarningProps {
  /* When the session goes idle (epoch ms); null closes the dialog. */
  deadline: number | null
  onStay: () => void
  onSignOut: () => void
  /* How long the warning lasts, for the ring's full turn. Default 60s. */
  warnMs?: number
  /* Seconds left when the ring and clock turn red. Default 10. */
  urgentAt?: number
  /* Seconds left at which screen readers hear the time. Default 60, 30, 10. */
  announceAt?: number[]
  title?: string
  /* The line under the title, around the ticking clock. */
  description?: (clock: React.ReactNode) => React.ReactNode
  stayLabel?: string
  signOutLabel?: string
}

const defaultDescription = (clock: React.ReactNode) => <>For your security, we’ll sign you out in {clock}.</>

export function IdleWarning({
  deadline,
  onStay,
  onSignOut,
  warnMs = 60_000,
  urgentAt = 10,
  announceAt = [60, 30, 10],
  title = "Still there?",
  description = defaultDescription,
  stayLabel = "Stay signed in",
  signOutLabel = "Sign out now",
}: IdleWarningProps): React.ReactElement {
  const [now, setNow] = React.useState(() => Date.now())
  const stayRef = React.useRef<HTMLButtonElement>(null)

  React.useEffect(() => {
    if (deadline === null) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [deadline])

  /* The last deadline stays drawn while the dialog closes, so the ring
     doesn't drain and turn red on its way out. */
  const [shown, setShown] = React.useState(deadline)
  if (deadline !== null && deadline !== shown) setShown(deadline)

  const remainingMs = shown === null ? 0 : Math.max(0, shown - now)
  const secs = Math.ceil(remainingMs / 1000)
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
  const urgent = secs <= urgentAt
  /* What's left of the warning, as the drawn part of the ring. */
  const left = Math.min(1, Math.max(0, (secs * 1000) / warnMs))

  /* Announce at coarse milestones only, so the live region fires a handful
     of times instead of once a second. */
  const announceSecs = announceAt.includes(secs) ? secs : null

  return (
    <DialogPrimitive.Root open={deadline !== null} onOpenChange={(o) => !o && onStay()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-modal-scrim transition-opacity duration-base ease-out data-ending-style:opacity-0 data-starting-style:opacity-0"
          data-slot="modal-backdrop"
        />
        <DialogPrimitive.Viewport
          className="fixed inset-0 z-50 grid grid-cols-[minmax(0,360px)] place-items-center justify-center overflow-y-auto px-4 pt-[max(--spacing(4),env(safe-area-inset-top))] pb-[max(--spacing(4),env(safe-area-inset-bottom))]"
          data-slot="modal-viewport"
        >
          <DialogPrimitive.Popup
            initialFocus={stayRef}
            className="flex w-full flex-col items-center rounded-3xl border border-border-subtle bg-card px-6 pt-7 pb-6 text-center text-foreground shadow-pop outline-none transition-[opacity,translate,scale] duration-base ease-out data-ending-style:translate-y-2 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0"
            data-slot="modal"
          >
            {/* The ring and the time in the line below tick every second but
                are not announced: a polite region updating at 1Hz queues an
                announcement per tick and buries the buttons the person is
                trying to reach. The sr-only region below speaks only at the
                milestones. */}
            <div aria-hidden className="relative grid size-24 place-items-center">
              <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0 -rotate-90">
                <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-track" />
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - left)}
                  className={cn(
                    "transition-[stroke-dashoffset,stroke] duration-base ease-out",
                    urgent ? "stroke-neg" : "stroke-orange",
                  )}
                />
              </svg>
              <Icons.time className={urgent ? "size-6 text-neg" : "size-6 text-orange"} />
            </div>

            <DialogPrimitive.Title className="mt-5 font-medium text-lg text-text-figure">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-text-secondary">
              {description(<span className="font-medium text-text-figure tabular-nums">{clock}</span>)}
            </DialogPrimitive.Description>
            <p className="sr-only" role="status">
              {announceSecs === null ? "" : `Signing out in ${announceSecs} seconds. Choose ${stayLabel} to continue.`}
            </p>

            <div className="mt-6 grid w-full grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="lg" onClick={onSignOut}>
                {signOutLabel}
              </Button>
              <Button ref={stayRef} type="button" variant="primary" size="lg" onClick={onStay}>
                {stayLabel}
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
