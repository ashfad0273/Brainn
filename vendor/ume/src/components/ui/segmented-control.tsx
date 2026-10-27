"use client";

import { motion } from "motion/react"
import * as React from "react"
import { SPRING } from "../../lib/ease"
import { HUE_CLASSES, type Hue } from "../../lib/hue"
import type { Icon } from "../../lib/icons"
import { useAppReducedMotion } from "../../lib/motion"
import { cn } from "../../lib/utils"

/* Segmented control — the pill toggle repeated across the entry/subscription/
   client/employee dialogs and Settings. Active segment gets a spring layoutId
   indicator (beUI segment tabs).

   The quiet look (Settings, approved Oct 2026): a 32px track in the field
   grey, 28px options labelled in Plex Sans 13 Medium (never mono), and the
   picked one on a white pill with the button shadow, no border. It fills its
   container (equal columns) unless `fit`, which hugs the labels.

   Semantically it is a radio group: one value out of a few, chosen with a
   click or with the arrow keys. Only the checked segment sits in the tab order
   (roving tabindex), so Tab moves past the whole control in one step, the way
   a native radio group behaves. Name it with `aria-labelledby` (a visible
   label) or `aria-label`. */

export type SegmentedOption<T extends string> = {
  value: T
  label: string
  /* Optional: tints the segment in this hue while it is selected (soft
     pill, ink label, hue ring), e.g. Income green / Expense rose. */
  hue?: Hue
  /* Optional 16px icon before the label, in the hue's solid when selected. */
  icon?: Icon
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  className,
  fit = false,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: {
  options: SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  className?: string
  /* Hug the labels instead of filling the width (a settings row). */
  fit?: boolean
  /* Lands on the radiogroup element, so focusById() can move focus into the
     control (it forwards to the checked segment). */
  id?: string
  "aria-label"?: string
  "aria-labelledby"?: string
  "aria-describedby"?: string
}): React.ReactElement {
  const layoutId = React.useId()
  const reduce = useAppReducedMotion()
  const transition = reduce ? { duration: 0 } : SPRING
  const buttons = React.useRef<Array<HTMLButtonElement | null>>([])

  /* If the value matches no option (it shouldn't), keep the first segment
     focusable so the control is never unreachable by keyboard. */
  const checkedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  )

  const select = (index: number) => {
    const n = options.length
    const next = ((index % n) + n) % n
    const opt = options[next]
    if (!opt) return
    buttons.current[next]?.focus()
    if (opt.value !== value) onValueChange(opt.value)
  }

  /* WAI-ARIA radio group keys: arrows move and select (wrapping), Home and
     End jump to the ends. Space/Enter come free from the native button. */
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault()
        select(index + 1)
        break
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault()
        select(index - 1)
        break
      case "Home":
        e.preventDefault()
        select(0)
        break
      case "End":
        e.preventDefault()
        select(options.length - 1)
        break
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      tabIndex={-1}
      onFocus={(e) => {
        /* Focus sent to the group itself (focusById, a label) moves on to
           the checked segment. */
        if (e.target === e.currentTarget) buttons.current[checkedIndex]?.focus()
      }}
      className={cn(
        "h-8 items-center rounded-full bg-field p-0.5 outline-none",
        fit ? "inline-flex w-fit" : "grid w-full",
        className,
      )}
      style={fit ? undefined : { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt, i) => {
        const active = value === opt.value
        const tint = opt.hue ? HUE_CLASSES[opt.hue] : null
        const OptIcon = opt.icon
        return (
          <motion.button
            key={opt.value}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === checkedIndex ? 0 : -1}
            onClick={() => onValueChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            whileTap={reduce ? undefined : { scale: 0.96 }}
            className={cn(
              "relative inline-flex h-7 min-w-14 cursor-pointer items-center justify-center rounded-full px-3 font-medium text-xs",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? (tint?.ink ?? "text-text-figure")
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                layout
                aria-hidden
                className={cn("absolute inset-0 rounded-full shadow-button", tint ? tint.soft : "bg-card")}
                transition={transition}
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
              {OptIcon ? (
                <OptIcon
                  aria-hidden
                  className={cn("size-4 shrink-0", active && tint ? tint.solid : undefined)}
                />
              ) : null}
              {opt.label}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
