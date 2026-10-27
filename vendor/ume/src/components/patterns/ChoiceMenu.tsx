import * as React from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { hueVar, type Hue } from "../../lib/hue"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { SegmentedPill } from "../ui/segmented-pill"
import { choiceMenu, choiceMenuBody, choiceMenuRow, choiceMenuTitle } from "./surface"

/* A single-choice filter (Ledger's account picker): a pill that opens the
   choice menu from the component sheet. The title in Label Mono, then one
   row per value with its colour swatch and a check on the chosen one. An
   optional "All …" row comes first; its swatch blends every option's
   colour. Picking closes the menu. FilterMenu is the multi-select sibling.

   ChoiceList is the same choice as a radio list, for the phone's Filters
   sheet (FilterBar): 48px rows, the chosen one on the brand's soft tint. */

export interface ChoiceOption {
  value: string
  label: string
  /* A swatch before the label: a hue, or any CSS background in `swatch`
     (used before hue). With neither, the row has no swatch. */
  hue?: Hue | null
  swatch?: string
}

/* The "All …" row: `null` is its value in `value` and `onChange`. */
const ALL = "\u0000all"

function fillOf(o: ChoiceOption): string | undefined {
  return o.swatch ?? (o.hue ? hueVar(o.hue) : undefined)
}

/* The options' fills, for the "All" row's blend. Empty when none has one. */
function fillsOf(options: ChoiceOption[]): string[] {
  return options.map(fillOf).filter((f): f is string => Boolean(f))
}

/* A 10px colour square. One string is any CSS background (a hue var, a
   token); several colours sit side by side in flat bands, so "All" reads as
   every colour at once without a gradient. */
export function Swatch({ fill, className }: { fill: string | string[]; className?: string }) {
  const fills = typeof fill === "string" ? [fill] : fill
  if (fills.length <= 1) {
    return <i aria-hidden className={cn("size-2.5 shrink-0 rounded-xs", className)} style={{ background: fills[0] }} />
  }
  return (
    <i aria-hidden className={cn("inline-flex size-2.5 shrink-0 overflow-hidden rounded-xs", className)}>
      {fills.map((f, i) => (
        <i key={i} className="h-full flex-1" style={{ background: f }} />
      ))}
    </i>
  )
}

interface ChoiceRow {
  key: string
  label: string
  fill?: string | string[]
}

/* The rows in order: "All" first when asked for, then the options. A row
   with no colour has no swatch; "All" has one when any option does. */
function rowsOf(options: ChoiceOption[], all: string | undefined, allSwatch: string | undefined): ChoiceRow[] {
  const fills = fillsOf(options)
  const rows: ChoiceRow[] = options.map((o) => ({ key: o.value, label: o.label, fill: fillOf(o) }))
  if (all) rows.unshift({ key: ALL, label: all, fill: allSwatch ?? (fills.length ? fills : undefined) })
  return rows
}

export interface ChoiceProps {
  /* The values, in order. */
  options: ChoiceOption[]
  /* The chosen value; `null` is the "All" row. */
  value: string | null
  onChange: (value: string | null) => void
  /* The label of an "All" row before the options ("All accounts"). Leave it
     out for a choice that is always one value. */
  all?: string
  /* A CSS background for the "All" swatch. By default it blends the
     options' colours in flat bands. */
  allSwatch?: string
}

/* The chosen row's label, for a trigger: the option's, or the "All" label. */
export function choiceLabel(options: ChoiceOption[], value: string | null, all?: string): string {
  return options.find((o) => o.value === value)?.label ?? all ?? ""
}

export function ChoiceMenu({
  title,
  options,
  value,
  onChange,
  all,
  allSwatch,
  icon,
  label,
  trigger,
  align = "start",
}: ChoiceProps & {
  /* The menu's title in Label Mono ("Account"), and the pill's key. */
  title: string
  /* The default trigger (a segmented pill: key, then the chosen value). */
  icon?: React.ReactNode
  /* The pill's key, when it differs from the title. */
  label?: string
  /* Replaces the pill (a SoloPill, a button); it receives the trigger's
     props. Give it its own aria-label. */
  trigger?: React.ReactElement<Record<string, unknown>>
  align?: "start" | "end"
}) {
  /* Nothing to choose: render nothing, so the rest of the bar stays as is.
     With one option it still shows, so "All" stays reachable. */
  if (!options.length) return null

  const rows = rowsOf(options, all, allSwatch)
  const chosen = choiceLabel(options, value, all)
  const key = label ?? title

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        render={trigger ?? <SegmentedPill icon={icon} label={key} value={chosen} aria-label={`${key}: ${chosen}`} />}
      />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner side="bottom" align={align} sideOffset={6} className="z-50">
          <MenuPrimitive.Popup className={choiceMenu}>
            <div className={choiceMenuBody}>
              <div className={choiceMenuTitle}>{title}</div>
              <MenuPrimitive.RadioGroup
                value={value ?? ALL}
                onValueChange={(next: string) => onChange(next === ALL ? null : next)}
              >
                {rows.map((r) => (
                  <MenuPrimitive.RadioItem key={r.key} value={r.key} closeOnClick className={choiceMenuRow}>
                    {r.fill ? <Swatch fill={r.fill} /> : null}
                    <span className="min-w-0 flex-auto truncate">{r.label}</span>
                    {r.key === (value ?? ALL) ? (
                      <Icons.success aria-hidden className="ms-4 size-4 shrink-0 text-foreground" />
                    ) : null}
                  </MenuPrimitive.RadioItem>
                ))}
              </MenuPrimitive.RadioGroup>
            </div>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

/* Radio-group keys: arrows move to the next or previous option and select
   it, wrapping, as a native radio group does. */
function radioArrows(e: React.KeyboardEvent<HTMLDivElement>) {
  const delta = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key]
  if (!delta) return
  const radios = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]"))
  const at = radios.indexOf(document.activeElement as HTMLButtonElement)
  if (at < 0) return
  e.preventDefault()
  const next = radios[(at + delta + radios.length) % radios.length]
  next.focus()
  next.click()
}

export function ChoiceList({
  options,
  value,
  onChange,
  all,
  allSwatch,
  className,
  ...aria
}: ChoiceProps & {
  /* Name the group: the id of its heading (FilterSection's), or a label. */
  "aria-labelledby"?: string
  "aria-label"?: string
  className?: string
}) {
  const rows = rowsOf(options, all, allSwatch)
  const current = value ?? (all ? ALL : null)
  /* With nothing chosen, the first row takes the tab stop. */
  const stop = rows.some((r) => r.key === current) ? current : rows[0]?.key

  return (
    <div role="radiogroup" onKeyDown={radioArrows} className={cn("flex flex-col gap-1", className)} {...aria}>
      {rows.map((r) => {
        const checked = r.key === current
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={r.key === stop ? 0 : -1}
            onClick={() => onChange(r.key === ALL ? null : r.key)}
            className={cn(
              "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              checked ? "bg-primary-soft" : "hover:bg-muted",
            )}
          >
            {r.fill ? <Swatch fill={r.fill} /> : null}
            <span className={cn("min-w-0 flex-1 truncate", checked && "font-medium text-primary-ink")}>{r.label}</span>
            <Icons.check aria-hidden className={cn("size-4 text-primary", checked ? "opacity-100" : "opacity-0")} />
          </button>
        )
      })}
    </div>
  )
}
