import * as React from "react"
import { Button, type ButtonState } from "../ui/button"
import { motion } from "motion/react"
import { SquidxWordmark } from "../brand/SquidxWordmark"
import { fadeUp, useAppReducedMotion } from "../../lib/motion"
import { cn } from "../../lib/utils"

/* The dotted canvas behind the signed-out pages: 2px dots every 19.2px.
   The pattern's id is per instance, so two layouts never share it. */
function DotGrid() {
  const id = `auth-dots-${React.useId().replace(/:/g, "")}`
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 -z-10 size-full">
      <defs>
        <pattern id={id} width="19.2" height="19.2" patternUnits="userSpaceOnUse">
          <circle cx="9.6" cy="9.6" r="1.05" className="fill-auth-dot" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/* The ten meridian rings behind the card, from the Figma Login page: two fans
   of ellipses that meet on the centre line, in the chart colours. A trail of
   each ring's colour travels around it. */
const RING_H = 582
const RING_MID = 439
const RINGS: Array<{ w: number; side: -1 | 1; stroke: string }> = [
  { w: 439, side: -1, stroke: "stroke-chart-8" },
  { w: 371, side: -1, stroke: "stroke-chart-4" },
  { w: 241, side: -1, stroke: "stroke-chart-1" },
  { w: 134, side: -1, stroke: "stroke-chart-10" },
  { w: 36, side: -1, stroke: "stroke-chart-8" },
  { w: 439, side: 1, stroke: "stroke-chart-2" },
  { w: 371, side: 1, stroke: "stroke-chart-10" },
  { w: 241, side: 1, stroke: "stroke-chart-4" },
  { w: 134, side: 1, stroke: "stroke-chart-5" },
  { w: 36, side: 1, stroke: "stroke-chart-9" },
]

/* The trail: stacked dashes of one colour, each a share of the ring (in
   pathLength units of 100) at partial opacity, all centred on the same point.
   The overlap is solid in the middle and thins out to both ends, so the trail
   fades without a gradient. */
const TRAIL = [30, 24, 18, 12, 6]
const TRAIL_OPACITY = 0.35

/* Per ring: where its trail starts (0–100) and how fast it laps (× 9s), so
   the ten trails never move in step. */
const PHASE = [0, 62, 24, 86, 48, 12, 74, 36, 98, 56]
const SPEED = [1, 1.2, 0.9, 1.35, 1.1, 1.05, 0.95, 1.25, 1.15, 1.3]

function Rings({ still }: { still: boolean }) {
  return (
    <svg
      aria-hidden
      width={RING_MID * 2 + 1}
      height={RING_H}
      viewBox={`0 0 ${RING_MID * 2 + 1} ${RING_H}`}
      fill="none"
      className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
    >
      {RINGS.map((r, i) => {
        const shape = {
          cx: RING_MID + 0.5 + (r.side * r.w) / 2,
          cy: RING_H / 2,
          rx: r.w / 2 - 0.5,
          ry: RING_H / 2 - 0.5,
          strokeWidth: 1,
        }
        const key = `${r.side}-${r.w}`
        /* Reduced motion: the still rings from the Figma frame. */
        if (still) return <ellipse key={key} {...shape} className={r.stroke} />
        return (
          <g key={key}>
            {TRAIL.map((len) => (
              <ellipse
                key={len}
                {...shape}
                pathLength={100}
                strokeDasharray={`${len} ${100 - len}`}
                strokeOpacity={TRAIL_OPACITY}
                className={cn(r.stroke, "animate-ring-travel")}
                style={
                  {
                    "--ring-from": len / 2 - PHASE[i],
                    "--ring-to": len / 2 - PHASE[i] - 100,
                    "--ring-speed": SPEED[i],
                  } as React.CSSProperties
                }
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

/* The frame for signed-out pages (sign-in, reset password), from the Figma
   Login page (68:3334): the dotted canvas and rings, a white card with the
   wordmark, a two-line page title (the second line muted), then the form.
   The credit pill sits at the foot of the page. */
/* The line under the card. Ledger's sign-off by default; pass `footer` for
   another app's, or null for none. */
const DEFAULT_FOOTER = <>© {new Date().getFullYear()} | All rights reserved. Made by Saber ❤️</>

export function AuthLayout({
  title,
  description,
  children,
  className,
  footer = DEFAULT_FOOTER,
  contained = false,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  footer?: React.ReactNode
  /* Fill the parent instead of the screen, to show the layout inside a box. */
  contained?: boolean
}) {
  const reduce = useAppReducedMotion()
  /* The page's main landmark, unless the layout sits inside another page. */
  const Card = contained ? "div" : "main"
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center overflow-hidden bg-auth-canvas px-4 text-foreground",
        contained ? "min-h-full" : "min-h-svh",
      )}
    >
      <DotGrid />
      <div className="flex w-full flex-1 items-center justify-center py-12">
        <motion.div
          variants={fadeUp}
          initial={reduce ? false : "hidden"}
          animate="show"
          className={cn("relative w-full sm:w-auto", className)}
        >
          <Rings still={!!reduce} />
          <Card className="flex flex-col items-center gap-15 rounded-4xl border border-border-subtle bg-card px-6 py-10 sm:px-30 sm:py-15">
            <SquidxWordmark className="h-8.5 w-52 text-icon-default" />
            <div className="flex w-full flex-col gap-10 py-6 sm:w-115">
              <div className="flex flex-col gap-1">
                <h1 className="font-medium text-2xl text-foreground">{title}</h1>
                {description ? (
                  <p className="text-pretty font-medium text-2xl text-text-disabled">{description}</p>
                ) : null}
              </div>
              {children}
            </div>
          </Card>
        </motion.div>
      </div>
      {footer != null && (
        <footer className="mb-12 rounded-lg border border-border-subtle bg-background px-5 py-2 font-medium text-foreground text-xs">
          {footer}
        </footer>
      )}
    </div>
  )
}

/* The filled field on the signed-out pages (Figma Screen · Login): 48px on
   the --input-filled surface, the hint and the typed value centred in Body
   Medium. The label is for screen readers only, as in the design. Focus
   draws the Figma ring: a 2px card-coloured gap, then 1.5px of foreground. */
const authBox =
  "rounded-lg bg-input-filled font-medium text-foreground text-sm outline-none transition-[box-shadow] duration-fast placeholder:text-text-tertiary focus:ring-[1.5px] focus:ring-foreground focus:ring-offset-2 focus:ring-offset-card aria-invalid:ring-2 aria-invalid:ring-destructive/20"

export function AuthField({
  label,
  id,
  className,
  ...props
}: { label: string; id: string } & React.ComponentProps<"input">) {
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} className={cn(authBox, "h-12 w-full min-w-0 px-3")} {...props} />
    </div>
  )
}

/* The sign-in code (migration 0035): six boxes over one real input, so
   paste, the phone's "from Messages/Mail" suggestion and screen readers all
   see a single field. Digits only; the sixth one calls onComplete. */
export function AuthCode({
  id,
  label,
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
  describedBy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  describedBy?: string
}) {
  const [focused, setFocused] = React.useState(false)
  const active = Math.min(value.length, CODE_LENGTH - 1)
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {/* Transparent and on top: taps land on the input. 16px text keeps
          iOS from zooming in on focus. The caret is always kept at the end. */}
      <input
        id={id}
        value={value}
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onSelect={(e) => {
          const end = e.currentTarget.value.length
          if (e.currentTarget.selectionStart !== end) e.currentTarget.setSelectionRange(end, end)
        }}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH)
          onChange(next)
          if (next.length === CODE_LENGTH && next !== value) onComplete?.(next)
        }}
        className="absolute inset-0 z-10 size-full cursor-text text-base text-transparent caret-transparent opacity-0 outline-none disabled:cursor-default"
      />
      <div aria-hidden className="grid grid-cols-6 gap-1.5 sm:gap-2.5">
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <div
            key={i}
            className={cn(
              "grid h-12 place-items-center rounded-lg bg-input-filled font-medium text-foreground text-xl tabular-nums transition-[box-shadow] duration-fast sm:h-14",
              invalid && "bg-neg-soft ring-1 ring-neg",
              focused && i === active && "ring-[1.5px] ring-foreground ring-offset-2 ring-offset-card",
              disabled && "opacity-64",
            )}
          >
            {value[i] ?? <span className="text-text-tertiary">·</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

const CODE_LENGTH = 6

/* The one-line error under the fields. Rendered unconditionally: several screen
   readers skip a live region that is inserted into the DOM already carrying
   its text, which meant a failed sign-in could give a blind user no feedback
   at all on the app's front door. */
export function FormError({ id, error }: { id: string; error: string }) {
  return (
    <p
      id={id}
      role="alert"
      className={error ? "px-0.5 font-medium text-neg-ink text-xs" : "sr-only"}
    >
      {error}
    </p>
  )
}

/* Idle → loading → success/error morph on the submit button. */
export function useButtonState() {
  const [state, setState] = React.useState<ButtonState>("idle")
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const flashError = () => {
    setState("error")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setState("idle"), 1600)
  }
  return { state, setState, flashError }
}

/* The "Remember password? Login" link under the reset screens. The muted
   lead and the label can be swapped ("Wrong address? Change it"). */
export function BackToLogin({
  onClick,
  lead = "Remember password?",
  label = "Login",
}: {
  onClick: () => void
  lead?: string
  label?: string
}) {
  return (
    <Button type="button" variant="link" size="sm" onClick={onClick} className={authLink}>
      {lead ? <span className="text-text-disabled">{lead}</span> : null}
      {label}
    </Button>
  )
}

/* The text links on the signed-out pages sit flush with the field edges. */
export const authLink = "px-0"

/* The 40px submit button on the signed-out pages (Figma Body Medium label). */
export const authSubmit = "h-10 rounded-lg px-8"
