import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { HUE_CLASSES, initials, type Hue } from "../../lib/hue"
import { cn } from "../../lib/utils"
import { FilterPill } from "../ui/segmented-pill"
import { CountBadge } from "./parts"
import { choiceMenu, choiceMenuBody, choiceMenuRow, choiceMenuTitle } from "./surface"

/* A multi-select filter (Transactions' Category / Person / Added by): a
   FilterPill that opens the choice menu from the component sheet. The title
   in Label Mono, then one row per value with the table's 12px square check,
   an initials circle (people) or a colour swatch (categories), the value and
   how many entries it has in the table's round count badge. `extra` rows sit under a separator (Category's
   "Archived"). Picking keeps the menu open; a "N selected · Clear" footer
   shows once something is picked. Built on the Base UI menu: arrow keys,
   type-ahead and checkbox semantics come with it. */

export interface FilterOption {
  value: string
  count: number
  /* People get an initials circle, categories a swatch in their hue (or a
     flat CSS colour in `swatch`, e.g. Transfer's `var(--transfer-swatch)`). */
  person?: boolean
  hue?: Hue | null
  swatch?: string
}

export function FilterMenu({
  label,
  options,
  extra = [],
  selected,
  onChange,
}: {
  label: string
  options: FilterOption[]
  extra?: FilterOption[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (value: string, on: boolean) =>
    onChange(on ? [...selected, value] : selected.filter((v) => v !== value))
  const item = (o: FilterOption) => (
    <MenuPrimitive.CheckboxItem
      key={o.value}
      checked={selected.includes(o.value)}
      onCheckedChange={(on) => toggle(o.value, on)}
      closeOnClick={false}
      className={choiceMenuRow}
    >
      <span
        aria-hidden
        className="relative inline-grid size-3 shrink-0 place-content-center rounded-check border border-border-strong bg-card transition-colors duration-fast group-data-checked:border-(--icon-default) group-data-checked:bg-(--icon-default) group-data-checked:after:h-0.75 group-data-checked:after:w-1.5 group-data-checked:after:-translate-y-px group-data-checked:after:-rotate-45 group-data-checked:after:border-card group-data-checked:after:border-b-[1.5px] group-data-checked:after:border-s-[1.5px] group-data-checked:after:content-['']"
      />
      {o.person ? (
        <span
          aria-hidden
          className="inline-grid size-6 shrink-0 place-items-center rounded-full border border-border-subtle bg-card text-label-mono"
        >
          {initials(o.value)}
        </span>
      ) : o.swatch ? (
        <i aria-hidden className="size-2.5 shrink-0 rounded-xs" style={{ background: o.swatch }} />
      ) : o.hue ? (
        <i aria-hidden className={cn("size-2.5 shrink-0 rounded-xs", HUE_CLASSES[o.hue].fill)} />
      ) : null}
      <span className="min-w-0 flex-auto truncate">{o.value}</span>
      <CountBadge count={o.count} label={`${o.count} ${o.count === 1 ? "entry" : "entries"}`} className="ms-4 shrink-0" />
    </MenuPrimitive.CheckboxItem>
  )

  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        render={<FilterPill label={label} count={selected.length} />}
        aria-label={selected.length ? `${label}: ${selected.join(", ")}` : `Filter by ${label.toLowerCase()}`}
        disabled={!options.length && !extra.length}
      />
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <MenuPrimitive.Popup className={choiceMenu}>
            <div className={choiceMenuBody}>
              <div className={choiceMenuTitle}>{label}</div>
              {options.map(item)}
              {extra.length ? (
                <>
                  <MenuPrimitive.Separator className="mx-2.5 my-1.5 h-px bg-border-subtle" />
                  {extra.map(item)}
                </>
              ) : null}
              {selected.length ? (
                <div className="mt-1.5 flex items-center justify-between gap-2 border-border-subtle border-t ps-2.5 pt-1.5">
                  <span className="text-text-secondary text-xs">{selected.length} selected</span>
                  <MenuPrimitive.Item
                    closeOnClick={false}
                    onClick={() => onChange([])}
                    className="h-7 cursor-pointer rounded-md px-2.5 font-medium text-btn-ghost-fg text-xs outline-none data-highlighted:bg-input-filled data-highlighted:text-foreground"
                  >
                    Clear
                  </MenuPrimitive.Item>
                </div>
              ) : null}
            </div>
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}
