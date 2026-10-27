import type * as React from "react"
import { legendKey } from "../charts/chart"
import { cn } from "../../lib/utils"

/* A page's hero figure (Ledger's Overview, Figma 67:1205): a mono label
   with a 12px swatch, the 44px figure (36px on a phone) and an optional
   line under it. The default swatch is the cash blend (--cash-swatch); pass
   `swatch` to blend other colours, or one colour for a flat square.

   The blend is one of the approved gradients (the Overview's cash swatch),
   so this file is on check-conventions' GRADIENT_ALLOWLIST. Its stops are
   tokens the caller passes. */

/* The swatch's background for a list of colours: evenly spaced stops on the
   approved 135° blend; one colour is a flat fill. Menus that show the same
   swatch (an "All accounts" row) use it too. */
export function swatchBackground(colours: readonly string[]): string {
  if (colours.length === 1) return colours[0]
  const stops = colours.map((c, i) => `${c} ${Math.round((i / (colours.length - 1)) * 100)}%`)
  return `linear-gradient(135deg, ${stops.join(", ")})`
}

export function HeroFigure({
  label,
  value,
  note,
  swatch,
  className,
}: {
  /* The mono label over the figure: "Cash on hand", "Total balance". */
  label: React.ReactNode
  /* The figure, formatted by the caller (taka() from lib/money). */
  value: React.ReactNode
  /* A line under the figure: "Up to today", or a change against last month. */
  note?: React.ReactNode
  /* CSS colours to blend in the swatch, in order, instead of the cash blend. */
  swatch?: readonly string[]
  className?: string
}) {
  const background = swatch && swatch.length > 0 ? swatchBackground(swatch) : "var(--cash-swatch)"
  return (
    <div className={cn("flex flex-col gap-1.25 px-4 py-2 sm:px-6", className)}>
      <span className={legendKey}>
        <i aria-hidden className="size-3 shrink-0" style={{ background }} />
        {label}
      </span>
      <span className="font-medium text-4xl text-text-figure tabular-nums sm:text-hero">{value}</span>
      {note ? <span className="px-1 font-medium text-text-secondary text-xs">{note}</span> : null}
    </div>
  )
}
