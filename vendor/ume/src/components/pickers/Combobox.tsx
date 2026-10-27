"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import * as React from "react"
import { initials } from "../../lib/hue"
import { Icons, type Icon } from "../../lib/icons"
import { useAppReducedMotion } from "../../lib/motion"
import { cn } from "../../lib/utils"
import { tint } from "../patterns/form"
import { filledField } from "../ui/date-field"
import { Select, SelectGroup, SelectGroupLabel, SelectItem, SelectPopup, SelectSeparator } from "../ui/select"

/* The combobox (from Ledger's "Paid to", Project and Category fields): pick
   one option from a list that opens under a filled field, with an optional
   search, groups, a leading icon, avatar or colour per row and an "add new"
   row.

     import { Combobox } from "@ume/ui/components/pickers/Combobox"

     <Combobox
       id="payee"
       options={[
         { value: "rahim", label: "Rahim Uddin", group: "People", avatar: true },
         { value: "psycle", label: "Psycle London", group: "Clients", icon: Icons.client },
       ]}
       value={payee}
       onChange={setPayee}
       placeholder="Person or company"
     />

   Three ways to search (`search`):
   - "field" (default): type in the field itself; the chevron opens the
     whole list. Emptying the field clears the pick.
   - "popup": the field is a button; the list opens with a search box at its
     top. The way to go with `onAdd`, so what was typed becomes the new name.
   - "none": no search, a plain select (built on Ume's Select). For short
     lists, or rows with two lines and a figure (`description`, `meta`).

   The arrow keys move, Enter picks and Escape closes in every mode. Rows
   take their group from `option.group`: options with no group come first,
   then each group under its label, in the order the options give them. */

export type ComboboxOption = {
  /* Unique across the list: it is what onChange returns. */
  value: string
  label: string
  /* Rows with the same group sit together under it. */
  group?: string
  /* Before the label, first one given wins: a colour square (a CSS colour,
     e.g. hueVar("violet")), an icon in a small square chip, or initials in a
     round chip (`true` takes them from the label). */
  swatch?: string
  icon?: Icon
  avatar?: string | true
  /* A grey second line under the label. */
  description?: React.ReactNode
  /* On the right: a figure, and an optional grey line under it. */
  meta?: React.ReactNode
  metaDescription?: React.ReactNode
  /* More words the search matches. */
  keywords?: readonly string[]
  disabled?: boolean
}

export interface ComboboxProps {
  id?: string
  options: readonly ComboboxOption[]
  /* The picked option's value, "" for none. */
  value: string
  /* The new value; "" when the field is emptied (search "field"). */
  onChange: (value: string) => void
  search?: "field" | "popup" | "none"
  /* The empty field's text. */
  placeholder?: string
  /* The search box's text and name (search "popup"). */
  searchPlaceholder?: string
  /* The list's accessible name. */
  label?: string
  /* The chevron button's name (search "field"). */
  triggerLabel?: string
  /* Shown when the search matches nothing. */
  emptyText?: string
  /* Shown when there are no options at all. Defaults to emptyText. */
  noOptionsText?: string
  /* A line between groups. */
  separators?: boolean
  /* What the field shows for the picked option (search "popup" and "none").
     Gets null when nothing is picked. */
  renderValue?: (option: ComboboxOption | null) => React.ReactNode
  /* A grey note under the list (search "none"). */
  footer?: React.ReactNode
  /* An "add new" row at the bottom of the list (search "field" or "popup").
     Picking it calls onAdd with what was typed in the search. */
  onAdd?: (query: string) => void
  /* The add row's words. */
  addLabel?: string
  /* Said above the add row when nothing else matches. */
  addHint?: string
  /* Draws the error ring and sets aria-invalid. */
  invalid?: boolean
  "aria-describedby"?: string
  disabled?: boolean
  /* Draws the focus ring while something tied to the field is open (the tag
     picker's new-tag form). */
  active?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /* Gets the field element, to anchor something else to it. */
  anchorRef?: React.RefObject<HTMLElement | null>
  /* Extra classes for the list (a different max height, say). */
  popupClassName?: string
  className?: string
  title?: string
}

/* The popup surface: a card with a hairline, its rows inset 6px, so a row's
   radius is the popup's minus the inset (rounded-pop / rounded-pop-row). */
export const comboboxPopupClassName =
  "flex w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) flex-col rounded-pop border border-border-subtle bg-card p-1.5 text-foreground shadow-pop outline-none"
const POPUP_MOTION =
  "transition-[scale,opacity] duration-fast ease-out data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0"
const POPUP_MOTION_REDUCED = "data-ending-style:opacity-0 data-starting-style:opacity-0"

/* One row. The highlight switches on instantly. */
export const comboboxRowClassName =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-pop-row px-2.5 text-start font-medium text-foreground text-sm outline-none data-highlighted:bg-input-filled data-disabled:pointer-events-none data-disabled:opacity-64"

const ADD_VALUE = "__ume_combobox_add__"

type Section = { key: string; label?: string; add?: boolean; items: ComboboxOption[] }

/* Ungrouped options first, then each group in the order the options name it. */
function sectionsOf(options: readonly ComboboxOption[]): Section[] {
  const loose: ComboboxOption[] = []
  const groups = new Map<string, ComboboxOption[]>()
  for (const o of options) {
    if (!o.group) loose.push(o)
    else groups.set(o.group, [...(groups.get(o.group) ?? []), o])
  }
  return [
    ...(loose.length ? [{ key: "__ungrouped__", items: loose }] : []),
    ...[...groups].map(([label, items]) => ({ key: `group:${label}`, label, items })),
  ]
}

/* The colour square, chip or avatar before a row's label. */
export function OptionLeading({ option }: { option: ComboboxOption }): React.ReactElement | null {
  if (option.swatch) {
    return <span aria-hidden style={tint(option.swatch)} className="size-2.5 shrink-0 rounded-xs bg-(--c)" />
  }
  if (option.icon) {
    const Glyph = option.icon
    return (
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-md bg-input-filled text-icon-default">
        <Glyph className="size-3.5" />
      </span>
    )
  }
  if (option.avatar) {
    return (
      <span
        aria-hidden
        className="grid size-6 shrink-0 place-items-center rounded-full bg-input-filled text-icon-default text-label-mono"
      >
        {initials(option.avatar === true ? option.label : option.avatar)}
      </span>
    )
  }
  return null
}

/* The label, with its second line and figure when it has them. */
function OptionBody({ option }: { option: ComboboxOption }) {
  const hasMeta = option.meta != null || option.metaDescription != null
  if (option.description == null && !hasMeta) return <span className="min-w-0 flex-1 truncate">{option.label}</span>
  return (
    <span className="flex min-w-0 flex-1 items-center gap-3 py-0.5">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{option.label}</span>
        {option.description != null ? (
          <span className="truncate font-normal text-text-secondary text-xs tabular-nums">{option.description}</span>
        ) : null}
      </span>
      {hasMeta ? (
        <span className="flex shrink-0 flex-col items-end">
          <span className="tabular-nums">{option.meta}</span>
          {option.metaDescription != null ? (
            <span className="font-normal text-text-secondary text-xs tabular-nums">{option.metaDescription}</span>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}

/* The picked option in a button field: its swatch or icon, then its label;
   the placeholder in grey when nothing is picked. */
function DefaultValue({ option, placeholder }: { option: ComboboxOption | null; placeholder: string }) {
  const Glyph = option?.icon
  return (
    <span className={cn("flex min-w-0 items-center gap-2", !option && "text-text-tertiary")}>
      {option?.swatch ? (
        <span aria-hidden style={tint(option.swatch)} className="size-2.5 shrink-0 rounded-xs bg-(--c)" />
      ) : Glyph ? (
        <Glyph aria-hidden />
      ) : null}
      <span className="truncate">{option?.label ?? placeholder}</span>
    </span>
  )
}

export function Combobox({
  id,
  options,
  value,
  onChange,
  search = "field",
  placeholder = "Pick one",
  searchPlaceholder = "Search",
  label,
  triggerLabel = "Show options",
  emptyText = "Nothing by that name",
  noOptionsText,
  separators = false,
  renderValue,
  footer,
  onAdd,
  addLabel = "Add new",
  addHint,
  invalid,
  "aria-describedby": describedBy,
  disabled,
  active,
  open: openProp,
  onOpenChange,
  anchorRef,
  popupClassName,
  className,
  title,
}: ComboboxProps): React.ReactElement {
  const reduce = useAppReducedMotion()
  const innerRef = React.useRef<HTMLElement | null>(null)
  const setAnchor = React.useCallback(
    (el: HTMLElement | null) => {
      innerRef.current = el
      if (anchorRef) anchorRef.current = el
    },
    [anchorRef],
  )
  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenChange?.(next)
  }
  const [query, setQuery] = React.useState("")
  const { contains } = ComboboxPrimitive.useFilter()

  const selected = options.find((o) => o.value === value) ?? null
  const sections = React.useMemo(() => sectionsOf(options), [options])

  /* --- No search: Ume's Select with a filled trigger. --------------------- */
  if (search === "none") {
    return (
      <Select
        value={value}
        onValueChange={(v) => onChange(String(v ?? ""))}
        open={openProp}
        onOpenChange={onOpenChange}
        disabled={disabled}
        items={options.map((o) => ({ value: o.value, label: o.label }))}
      >
        <SelectPrimitive.Trigger
          ref={setAnchor}
          id={id}
          title={title}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            filledField,
            "cursor-pointer justify-between gap-2 text-start data-disabled:cursor-default data-disabled:opacity-64",
            invalid ? "shadow-field-error" : active && "shadow-field-focus",
            className,
          )}
        >
          {renderValue ? renderValue(selected) : <DefaultValue option={selected} placeholder={placeholder} />}
          <Icons.chevronDown aria-hidden className="size-4 shrink-0 text-icon-muted" />
        </SelectPrimitive.Trigger>
        <SelectPopup
          alignItemWithTrigger={false}
          sideOffset={6}
          aria-label={label}
          className={cn("max-h-[min(var(--available-height),24rem)]", popupClassName)}
        >
          {sections.map((s, i) => {
            const rows = s.items.map((o) => {
              const lead = <OptionLeading option={o} />
              return (
                <SelectItem key={o.value} value={o.value} disabled={o.disabled}>
                  {o.swatch || o.icon || o.avatar ? (
                    <span className="flex min-w-0 items-center gap-2">
                      {lead}
                      <OptionBody option={o} />
                    </span>
                  ) : (
                    <OptionBody option={o} />
                  )}
                </SelectItem>
              )
            })
            return (
              <React.Fragment key={s.key}>
                {separators && i > 0 ? <SelectSeparator /> : null}
                {s.label ? (
                  <SelectGroup>
                    <SelectGroupLabel>{s.label}</SelectGroupLabel>
                    {rows}
                  </SelectGroup>
                ) : (
                  rows
                )}
              </React.Fragment>
            )
          })}
          {footer ? (
            <>
              <SelectSeparator />
              <p className="px-2 py-1.5 text-text-secondary text-xs">{footer}</p>
            </>
          ) : null}
        </SelectPopup>
      </Select>
    )
  }

  /* --- With a search: Base UI's Combobox. --------------------------------- */
  const inPopup = search === "popup"
  const addOption: ComboboxOption | null = onAdd ? { value: ADD_VALUE, label: addLabel } : null
  const items: Section[] = addOption ? [...sections, { key: "__add__", add: true, items: [addOption] }] : sections
  const matches = (o: ComboboxOption, q: string) =>
    contains(o.label, q) || !!o.keywords?.some((k) => contains(k, q))
  const q = query.trim()
  /* Only the add row is left: say so, and point at it. */
  const noMatch = !!addOption && !!q && !options.some((o) => matches(o, q))
  const empty = options.length ? emptyText : (noOptionsText ?? emptyText)

  const list = (
    <ComboboxPrimitive.List
      className={cn(
        inPopup && "flex max-h-[min(var(--available-height),15rem)] flex-col overflow-y-auto thin-scrollbar",
        inPopup && popupClassName,
      )}
    >
      {(section: Section, index: number) => (
        <ComboboxPrimitive.Group key={section.key} items={section.items} className="flex flex-col">
          {section.add || (separators && index > 0) ? (
            <div aria-hidden className="mx-1 my-1 h-px shrink-0 bg-border-subtle" />
          ) : null}
          {section.label ? (
            <ComboboxPrimitive.GroupLabel className="px-2.5 pt-2 pb-1 text-label-mono text-text-secondary">
              {section.label}
            </ComboboxPrimitive.GroupLabel>
          ) : null}
          <ComboboxPrimitive.Collection>
            {(o: ComboboxOption) =>
              o.value === ADD_VALUE ? (
                <ComboboxPrimitive.Item key={o.value} value={o} className={cn(comboboxRowClassName, "h-9 text-text-secondary")}>
                  <Icons.add aria-hidden className="size-4 shrink-0 text-icon-muted" />
                  {o.label}
                </ComboboxPrimitive.Item>
              ) : (
                <ComboboxPrimitive.Item
                  key={o.value}
                  value={o}
                  disabled={o.disabled}
                  className={cn(
                    comboboxRowClassName,
                    o.description != null || o.meta != null
                      ? "min-h-10 py-1.5"
                      : o.icon || o.avatar
                        ? "h-10"
                        : "h-9",
                  )}
                >
                  <OptionLeading option={o} />
                  <OptionBody option={o} />
                  {inPopup ? (
                    <ComboboxPrimitive.ItemIndicator>
                      <Icons.check aria-hidden className="size-4 shrink-0 text-icon-default" />
                    </ComboboxPrimitive.ItemIndicator>
                  ) : null}
                </ComboboxPrimitive.Item>
              )
            }
          </ComboboxPrimitive.Collection>
        </ComboboxPrimitive.Group>
      )}
    </ComboboxPrimitive.List>
  )

  return (
    <ComboboxPrimitive.Root<ComboboxOption>
      items={items}
      value={selected}
      open={open}
      disabled={disabled}
      onOpenChange={setOpen}
      onValueChange={(o) => {
        if (o?.value === ADD_VALUE) {
          setOpen(false)
          onAdd?.(q)
        } else if (o) onChange(o.value)
        else if (!inPopup) onChange("")
      }}
      {...(inPopup ? { inputValue: query } : {})}
      onInputValueChange={(text) => {
        setQuery(text)
        /* Emptying the field clears the pick. */
        if (!inPopup && !text.trim() && value) onChange("")
      }}
      /* The add row stays whatever the search says. */
      filter={(o, text) => o.value === ADD_VALUE || matches(o, text)}
      itemToStringLabel={(o) => (o.value === ADD_VALUE ? "" : o.label)}
      isItemEqualToValue={(a, b) => a.value === b.value}
    >
      {inPopup ? (
        <ComboboxPrimitive.Trigger
          ref={setAnchor}
          id={id}
          title={title}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            filledField,
            "cursor-pointer justify-between text-start data-disabled:cursor-default data-disabled:opacity-64",
            invalid ? "shadow-field-error" : "data-popup-open:shadow-field-focus",
            active && "shadow-field-focus",
            className,
          )}
        >
          {renderValue ? renderValue(selected) : <DefaultValue option={selected} placeholder={placeholder} />}
          <Icons.chevronDown aria-hidden className="size-4 shrink-0 text-icon-muted" />
        </ComboboxPrimitive.Trigger>
      ) : (
        <div
          ref={setAnchor}
          title={title}
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg bg-input-filled ps-3 pe-2.5 font-medium text-sm text-text-figure transition-[box-shadow] duration-fast",
            invalid ? "shadow-field-error" : active ? "shadow-field-focus" : "focus-within:shadow-field-focus",
            disabled && "opacity-64",
            className,
          )}
        >
          <ComboboxPrimitive.Input
            id={id}
            placeholder={placeholder}
            autoComplete="off"
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-tertiary"
          />
          <ComboboxPrimitive.Trigger
            aria-label={triggerLabel}
            className="grid shrink-0 cursor-pointer place-items-center text-icon-muted outline-none [&_svg]:size-4"
          >
            <Icons.chevronDown aria-hidden />
          </ComboboxPrimitive.Trigger>
        </div>
      )}
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner anchor={innerRef} side="bottom" align="start" sideOffset={6} className="z-50">
          <ComboboxPrimitive.Popup
            aria-label={label}
            className={cn(
              comboboxPopupClassName,
              reduce ? POPUP_MOTION_REDUCED : POPUP_MOTION,
              inPopup
                ? "min-w-60"
                : cn("max-h-[min(var(--available-height),17.5rem)] overflow-y-auto thin-scrollbar", popupClassName),
            )}
          >
            {inPopup ? (
              <label className="mb-1 flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-row-stripe px-2.5">
                <Icons.search aria-hidden className="size-4 shrink-0 text-icon-muted" />
                <ComboboxPrimitive.Input
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent font-medium text-sm outline-none placeholder:text-text-tertiary"
                />
              </label>
            ) : null}
            <ComboboxPrimitive.Empty
              className={inPopup ? "not-empty:px-2.5 not-empty:py-2 text-sm text-text-secondary" : "not-empty:p-2.5 text-text-secondary text-xs"}
            >
              {empty}
            </ComboboxPrimitive.Empty>
            {noMatch && addHint ? <p className="px-2.5 py-2 text-sm text-text-secondary">{addHint}</p> : null}
            {list}
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}
