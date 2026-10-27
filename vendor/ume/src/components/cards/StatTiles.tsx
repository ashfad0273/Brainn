import type * as React from "react"
import { legendKey } from "../charts/chart"
import type { Hue } from "../../lib/hue"
import { cn } from "../../lib/utils"

/* The stat tiles under a page's hero (Ledger's Overview, Figma 67:1205): a
   row of 260px tiles, each a label with a swatch, a count line and a 36px
   figure. With `onPress` each tile is a toggle button: pressing one picks
   its figure out (point a chart at it, filter a table to it) and pressing it
   again goes back to everything. Without it the tiles are plain figures.

   Each tile: a right hairline, a 2px bar in its hue along the bottom, no top
   border, and a wash that fades from transparent to the hue at 5% (10% on
   hover or while pressed). The wash is an approved gradient, so this file
   is on check-conventions' GRADIENT_ALLOWLIST. The hue rides in `--c`.
   Under 1100px the tiles share the row and wrap. */

/* Declared as classes (not an inline style) so the built CSS declares `--c`. */
const HUE: Record<Hue, string> = {
  violet: "[--c:var(--violet)]",
  blue: "[--c:var(--blue)]",
  sky: "[--c:var(--sky)]",
  teal: "[--c:var(--teal)]",
  green: "[--c:var(--green)]",
  lime: "[--c:var(--lime)]",
  amber: "[--c:var(--amber)]",
  orange: "[--c:var(--orange)]",
  rose: "[--c:var(--rose)]",
  pink: "[--c:var(--pink)]",
}

export interface StatTile<Id extends string = string> {
  id: Id
  label: React.ReactNode
  hue: Hue
  /* The figure, formatted by the caller (taka() from lib/money). */
  value: React.ReactNode
  /* The count line over the figure: "9 payments in". */
  count?: number
  /* [singular, plural]: ["client", "clients"]. */
  unit?: readonly [string, string]
  /* A line over the figure instead of the count, when there is nothing to count. */
  note?: React.ReactNode
  /* A unit after the figure, smaller: "/month", "/year". */
  per?: string
}

/* The count line ("9 payments in") over the 36px figure, 6px apart. Use it
   in a tile of your own (Ledger's account tiles) so the figures line up. */
export function TileFigure({
  count,
  unit,
  note,
  value,
  per,
}: {
  count?: number
  unit?: readonly [string, string]
  note?: React.ReactNode
  value: React.ReactNode
  per?: string
}) {
  return (
    <span className="flex flex-col gap-1.5">
      {count != null ? (
        <span className="flex items-center gap-1 px-1">
          <span className="text-label-mono text-text-figure tabular-nums">{count.toLocaleString()}</span>
          {unit ? <span className="text-text-secondary text-xs">{count === 1 ? unit[0] : unit[1]}</span> : null}
        </span>
      ) : note ? (
        <span className="px-1 text-text-secondary text-xs">{note}</span>
      ) : null}
      <span className="font-medium text-4xl text-text-figure tabular-nums">
        {value}
        {per ? <span className="ms-0.5 text-lg text-text-secondary">{per}</span> : null}
      </span>
    </span>
  )
}

const tileBase =
  "flex min-h-40 shrink-0 grow-0 basis-65 flex-col justify-between gap-10 px-4 py-3 text-start sm:px-6 max-[1100px]:shrink max-[1100px]:grow max-[1100px]:basis-55 shadow-[inset_-1px_0_0_var(--border-subtle),inset_0_-2px_0_var(--c)] bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--c)_5%,transparent))]"
const tilePressable =
  "cursor-pointer appearance-none border-0 outline-none hover:bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--c)_10%,transparent))] aria-pressed:bg-[linear-gradient(180deg,transparent,color-mix(in_srgb,var(--c)_10%,transparent))] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

export function StatTiles<Id extends string>({
  tiles,
  pressed = null,
  onPress,
  label,
  className,
}: {
  tiles: StatTile<Id>[]
  /* The pressed tile, or null for none. */
  pressed?: Id | null
  /* Makes each tile a toggle; called with its id, or null when pressed again. */
  onPress?: (id: Id | null) => void
  /* The group's name, saying what pressing does: "Show on chart", "Show only". */
  label: string
  className?: string
}) {
  if (!tiles.length) return null
  return (
    <div role="group" aria-label={label} className={cn("flex max-[1100px]:flex-wrap max-[1100px]:gap-y-4", className)}>
      {tiles.map((t) => {
        const body = (
          <>
            <span className={legendKey}>
              <i aria-hidden className="size-3 shrink-0 bg-(--c)" />
              {t.label}
            </span>
            <TileFigure count={t.count} unit={t.unit} note={t.note} value={t.value} per={t.per} />
          </>
        )
        if (!onPress) {
          return (
            <div key={t.id} className={cn(HUE[t.hue], tileBase)}>
              {body}
            </div>
          )
        }
        const on = pressed === t.id
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onPress(on ? null : t.id)}
            className={cn(HUE[t.hue], tileBase, tilePressable)}
          >
            {body}
          </button>
        )
      })}
    </div>
  )
}
