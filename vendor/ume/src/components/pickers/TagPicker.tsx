"use client"

import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import * as React from "react"
import { HUES, hueVar, type Hue } from "../../lib/hue"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { onRadioKeys, tint } from "../patterns/form"
import { Button } from "../ui/button"
import { filledField } from "../ui/date-field"
import { Combobox, comboboxPopupClassName, type ComboboxOption } from "./Combobox"

/* The tag picker (from Ledger's Category field, the approved M1/M3 sheet): a
   field that opens a searchable menu of named tags, each with its colour
   square. Typing in the menu's search filters it; the arrow keys move, Enter
   picks and Escape closes.

     import { TagPicker } from "@ume/ui/components/pickers/TagPicker"

     <TagPicker
       id="category"
       tags={[{ name: "Rent", hue: "blue" }, { name: "Software", hue: "violet" }]}
       value={category}
       onChange={setCategory}
       onCreate={({ name, hue }) => addTag(name, hue)}
       noun={{ one: "category", other: "categories" }}
     />

   With `onCreate`, "New <tag>" sits at the bottom of the menu. It swaps the
   menu for a small form under the field: a name with a live preview of the
   chip, the colour swatches, Back and Add. Enter adds the tag (never the
   whole form around it); Escape or Back returns without adding. What was
   typed in the search becomes the new name.

   TagNameField and TagSwatches are the form's two parts on their own, for a
   settings page that makes or edits a tag the same way. */

export type Tag = {
  name: string
  /* The tag's colour: a hue, or any CSS colour (a shade, say), which wins. */
  hue?: Hue
  color?: string
}

/* A tag being made: its name and colour. */
export type TagDraft<H extends Hue = Hue> = { name: string; hue: H }

/* The words for a tag in the copy: "Pick a category", "New category". */
export type TagNoun = { one: string; other: string }

const DEFAULT_NOUN: TagNoun = { one: "tag", other: "tags" }

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const tagColor = (tag: Tag | undefined): string =>
  tag?.color ?? hueVar(tag?.hue ?? "blue")

export interface TagPickerProps<H extends Hue = Hue> {
  id?: string
  tags: readonly Tag[]
  /* The picked tag's name, "" for none. */
  value: string
  onChange: (name: string) => void
  /* Every tag's colour by name, over the tags' own (an app with its own
     colour table, or a picked name that isn't in the list). */
  colorOf?: (name: string) => string
  /* Turns on "New <tag>". Called on Add with the name (trimmed) and colour. */
  onCreate?: (draft: TagDraft<H>) => void
  /* Whether Add can be pressed. Defaults to a non-empty name no tag has. */
  canCreate?: boolean
  /* The colours a new tag can take, in order. */
  hues?: readonly H[]
  noun?: TagNoun
  /* The new-tag form's heading. Defaults to "New <tag>". */
  createTitle?: string
  maxNameLength?: number
  /* The new tag, to hold it in the form around the picker: null while the
     form is closed. Leave both out and the picker keeps it. */
  draft?: TagDraft<H> | null
  onDraftChange?: (draft: TagDraft<H> | null) => void
  /* A FieldError for the new name (a name that's taken). */
  createError?: React.ReactNode
  /* id, aria-invalid and aria-describedby for the new name's input. */
  draftInputProps?: React.ComponentProps<"input">
  invalid?: boolean
  "aria-describedby"?: string
  disabled?: boolean
}

export function TagPicker<H extends Hue = Hue>({
  id,
  tags,
  value,
  onChange,
  colorOf,
  onCreate,
  canCreate,
  hues = HUES as readonly Hue[] as readonly H[],
  noun = DEFAULT_NOUN,
  createTitle,
  maxNameLength = 24,
  draft: draftProp,
  onDraftChange,
  createError,
  draftInputProps,
  invalid,
  "aria-describedby": describedBy,
  disabled,
}: TagPickerProps<H>): React.ReactElement {
  const anchorRef = React.useRef<HTMLElement | null>(null)
  const [open, setOpen] = React.useState(false)
  const [draftState, setDraftState] = React.useState<TagDraft<H> | null>(null)
  const controlled = draftProp !== undefined
  const draft = controlled ? draftProp : draftState
  const setDraft = (next: TagDraft<H> | null) => {
    if (!controlled) setDraftState(next)
    onDraftChange?.(next)
  }
  const creating = draft !== null
  const byName = new Map(tags.map((t) => [t.name, t]))
  const colourOf = (n: string) => colorOf?.(n) ?? tagColor(byName.get(n))
  const firstHue = hues[0] as H
  const hue = draft?.hue ?? firstHue
  const name = (draft?.name ?? "").trim()
  const taken = !!name && tags.some((t) => t.name.toLowerCase() === name.toLowerCase())
  const canAdd = canCreate ?? (!!name && !taken)

  const options: ComboboxOption[] = tags.map((t) => ({ value: t.name, label: t.name, swatch: colourOf(t.name) }))

  const add = () => {
    if (!draft || !canAdd) return
    onCreate?.({ name, hue: draft.hue })
    if (!controlled) setDraftState(null)
  }

  return (
    <>
      <Combobox
        id={id}
        search="popup"
        options={options}
        value={value}
        onChange={(v) => {
          if (v) onChange(v)
        }}
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (next && creating) setDraft(null)
        }}
        anchorRef={anchorRef}
        active={creating}
        invalid={invalid}
        aria-describedby={describedBy}
        disabled={disabled}
        label={capital(noun.other)}
        placeholder={`Pick a ${noun.one}`}
        searchPlaceholder={`Search ${noun.other}`}
        emptyText={`No ${noun.one} by that name.`}
        /* The picked name as it is, even one no longer in the list. */
        renderValue={() => (
          <span className={cn("flex min-w-0 items-center gap-2", !value && "text-text-tertiary")}>
            {value ? (
              <span aria-hidden style={tint(colourOf(value))} className="size-2.5 shrink-0 rounded-xs bg-(--c)" />
            ) : null}
            <span className="truncate">{value || `Pick a ${noun.one}`}</span>
          </span>
        )}
        {...(onCreate
          ? {
              onAdd: (query: string) => setDraft({ name: query, hue: firstHue }),
              addLabel: `New ${noun.one}`,
              addHint: `No match. Add it as a new ${noun.one}.`,
            }
          : {})}
      />

      {/* The new-tag form, in the menu's place under the field. */}
      <PopoverPrimitive.Root
        open={creating}
        onOpenChange={(next) => {
          if (!next) setDraft(null)
        }}
      >
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Positioner anchor={anchorRef} side="bottom" align="start" sideOffset={6} className="z-50">
            <PopoverPrimitive.Popup
              aria-label={createTitle ?? `New ${noun.one}`}
              finalFocus={anchorRef}
              className={cn(
                comboboxPopupClassName,
                "min-w-60 gap-3 p-3 transition-[scale,opacity] duration-fast ease-out data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
              )}
            >
              <span className="text-label-mono text-text-secondary">{createTitle ?? `New ${noun.one}`}</span>
              <TagNameField
                size="sm"
                name={draft?.name ?? ""}
                onNameChange={(n) => setDraft({ name: n, hue })}
                hue={hue}
                onEnter={add}
                autoFocus
                maxLength={maxNameLength}
                placeholder={`${capital(noun.one)} name`}
                aria-label={`New ${noun.one} name`}
                inputProps={draftInputProps}
              />
              {createError}
              <TagSwatches
                size="sm"
                hues={hues}
                hue={hue}
                onHueChange={(h) => setDraft({ name: draft?.name ?? "", hue: h })}
                aria-label="Colour"
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft(null)
                    setOpen(true)
                  }}
                >
                  Back
                </Button>
                <Button type="button" variant="primary" size="sm" disabled={!canAdd} onClick={add}>
                  Add {noun.one}
                </Button>
              </div>
            </PopoverPrimitive.Popup>
          </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </>
  )
}

/* A tag's name with a live preview of its chip beside it. Leave out
   `onNameChange` to show the name read-only (a tag that can't be renamed).
   Enter calls `onEnter`, not the form's submit. `sm` (32px) sits in the
   picker's popup, `md` (36px) in a form. */
export function TagNameField({
  name,
  onNameChange,
  hue,
  color,
  onEnter,
  size = "md",
  id,
  placeholder = "Tag name",
  maxLength = 24,
  autoFocus,
  "aria-label": ariaLabel,
  inputProps,
}: {
  name: string
  onNameChange?: (name: string) => void
  hue: Hue
  /* A CSS colour for the preview instead of the hue's. */
  color?: string
  onEnter?: () => void
  size?: "sm" | "md"
  id?: string
  placeholder?: string
  maxLength?: number
  autoFocus?: boolean
  "aria-label"?: string
  /* More props for the input: id, aria-invalid, aria-describedby. */
  inputProps?: React.ComponentProps<"input">
}): React.ReactElement {
  const shown = name.trim()
  const sm = size === "sm"
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        autoFocus={autoFocus}
        readOnly={!onNameChange}
        /* A read-only name isn't a field to type in: no tab stop, no ring. */
        tabIndex={onNameChange ? undefined : -1}
        value={name}
        onChange={(e) => onNameChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            /* Adds the tag, not the whole form around it. */
            e.preventDefault()
            onEnter()
          }
        }}
        {...inputProps}
        className={cn(
          filledField,
          "flex-1 aria-invalid:shadow-field-error",
          sm && "h-8",
          !onNameChange && "text-text-secondary focus-visible:shadow-none",
        )}
      />
      <span
        aria-hidden
        style={tint(color ?? hueVar(hue))}
        className={cn(
          "tint-selected flex max-w-[45%] shrink-0 items-center gap-1.5 border text-foreground",
          sm ? "h-8 rounded-md px-2 font-medium text-xs" : "h-9 rounded-lg px-2.5 text-label-lg",
        )}
      >
        <span className="size-2 shrink-0 rounded-xs bg-(--c)" />
        <span className="truncate">{shown || "Preview"}</span>
      </span>
    </div>
  )
}

/* The colours a tag can take, as a radio group. Leave out `onHueChange` to
   show them without letting them change. */
export function TagSwatches<H extends Hue = Hue>({
  hues = HUES as readonly Hue[] as readonly H[],
  hue,
  onHueChange,
  size = "md",
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
}: {
  hues?: readonly H[]
  hue: H
  onHueChange?: (hue: H) => void
  size?: "sm" | "md"
  "aria-label"?: string
  "aria-labelledby"?: string
}): React.ReactElement {
  const sm = size === "sm"
  /* Read-only: the picked colour stays at full strength, the others are
     disabled. */
  const readOnly = !onHueChange
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      aria-readonly={readOnly || undefined}
      className={cn("flex flex-wrap", sm ? "gap-1.5" : "gap-2")}
    >
      {hues.map((h) => {
        const on = hue === h
        return (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={capital(h)}
            disabled={readOnly && !on}
            tabIndex={on ? 0 : -1}
            onClick={() => onHueChange?.(h)}
            onKeyDown={onRadioKeys}
            style={tint(hueVar(h))}
            className={cn(
              "group grid cursor-pointer place-items-center rounded-md bg-(--c) text-icon-on-primary outline-none transition-[box-shadow] duration-fast focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring disabled:cursor-default disabled:opacity-64 aria-checked:swatch-ring",
              sm ? "size-6" : "size-7",
              readOnly && "cursor-default",
            )}
          >
            <Icons.check
              aria-hidden
              className={cn(
                "opacity-0 transition-opacity duration-fast group-aria-checked:opacity-100",
                sm ? "size-3.5" : "size-4",
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
