import * as React from "react"
import { FormLabel, onRadioKeys } from "./form"
import { filledField } from "../ui/date-field"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"
import { NOTE_FORM_MAX, TEXT_MAX } from "../../lib/limits"

/* Shared bits for the data-entry dialogs. Keeps the error markup, the
   focus-the-bad-field behaviour and the unsaved-changes tracking identical
   across every form. */

/* Inline validation message under a field. `htmlFor` is the id of the control
   this message belongs to; pair it with errorProps() on that control so screen
   readers read the message as the field's description and report the field as
   invalid. No aria-live: focusById() moves focus to the bad control on submit,
   which announces the description anyway, and a live region here would say it
   twice. */
export function FieldError({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode
  htmlFor: string
  className?: string
}): React.ReactElement | null {
  if (!children) return null
  return (
    <p id={errorId(htmlFor)} className={cn("mt-1 text-destructive-foreground text-xs", className)}>
      {children}
    </p>
  )
}

export function errorId(controlId: string): string {
  return `${controlId}-error`
}

/* Spread onto the control that FieldError describes. */
export function errorProps(
  controlId: string,
  error: React.ReactNode,
): { "aria-invalid"?: true; "aria-describedby"?: string } {
  if (!error) return {}
  return { "aria-invalid": true, "aria-describedby": errorId(controlId) }
}

/* Move focus to the control that failed validation so the user lands on the
   problem instead of hunting for it. */
export function focusById(id: string): void {
  if (typeof document === "undefined") return
  const el = document.getElementById(id)
  if (el) (el as HTMLElement).focus()
}

/* Form state for a dialog: one values object, its per-field errors, and
   whether anything changed since the form was seeded.

   The form re-seeds (values from `seed()`, errors cleared) when the dialog
   opens, or when `seedKey` changes while it is open — e.g. a different row
   picked for editing. Nothing else resets it: a roster reloading in the
   background (new array identity) never wipes what the user has typed.
   Seeding happens during render, so the first frame of an opening dialog
   already shows the right values instead of the last ones. */
export function useFormValues<T extends Record<string, unknown>>({
  open,
  seed,
  seedKey,
  ignore,
}: {
  open: boolean
  seed: () => T
  seedKey?: unknown
  /* Fields that don't count as an edit worth guarding (e.g. a type toggle). */
  ignore?: ReadonlyArray<keyof T>
}): {
  values: T
  /* Set one field; clears that field's error. */
  set: <K extends keyof T>(key: K, value: T[K]) => void
  /* Set several fields at once (no error clearing). */
  patch: (next: Partial<T>) => void
  /* Change fields as if they had been seeded that way — a late-arriving
     default rather than a user edit, so the form stays clean. */
  rebase: (next: Partial<T>) => void
  errors: Partial<Record<keyof T, string>>
  /* Show every error at once and focus the first one, in field order (the
     insertion order of `errs`). `ids` maps a field to its control's id.
     Returns true when there were errors. */
  fail: (
    errs: Partial<Record<keyof T, string>>,
    ids: Partial<Record<keyof T, string>>,
  ) => boolean
  setError: (key: keyof T, message: string) => void
  dirty: boolean
} {
  const [values, setValues] = React.useState<T>(seed)
  const [initial, setInitial] = React.useState<T>(values)
  const [errors, setErrors] = React.useState<Partial<Record<keyof T, string>>>({})
  const [seeded, setSeeded] = React.useState<{ open: boolean; key: unknown }>({
    open: false,
    key: undefined,
  })

  if (open && (!seeded.open || !Object.is(seeded.key, seedKey))) {
    const next = seed()
    setSeeded({ open: true, key: seedKey })
    setValues(next)
    setInitial(next)
    setErrors({})
  } else if (!open && seeded.open) {
    setSeeded({ open: false, key: seedKey })
  }

  const set = React.useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const patch = React.useCallback((next: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...next }))
  }, [])

  const rebase = React.useCallback((next: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...next }))
    setInitial((prev) => ({ ...prev, ...next }))
  }, [])

  const fail = React.useCallback(
    (
      errs: Partial<Record<keyof T, string>>,
      ids: Partial<Record<keyof T, string>>,
    ) => {
      setErrors(errs)
      const first = (Object.keys(errs) as Array<keyof T>).find((k) => errs[k])
      if (first === undefined) return false
      const id = ids[first]
      /* After the error markup renders, so aria-describedby already points
         at the message when focus lands and it is read out. */
      if (id) requestAnimationFrame(() => focusById(id))
      return true
    },
    [],
  )

  const setError = React.useCallback((key: keyof T, message: string) => {
    setErrors((prev) => ({ ...prev, [key]: message }))
  }, [])

  const dirty = (Object.keys(values) as Array<keyof T>).some(
    (k) => !ignore?.includes(k) && !Object.is(values[k], initial[k]),
  )

  return { values, set, patch, rebase, errors, fail, setError, dirty }
}

/* ── Compact form parts (People, Subscriptions): the Add a transaction
   modal's filled fields, two to a row, labels above, no icons inside. ── */

/* Two fields side by side; one column on phones. */
export function FormRow({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}

/* A plain filled text field with its label above and its error under it. */
export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  optional,
  ...props
}: Omit<React.ComponentProps<"input">, "id" | "value" | "onChange"> & {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  optional?: boolean
}): React.ReactElement {
  return (
    <div>
      <FormLabel htmlFor={id} aside={optional ? "Optional" : undefined}>
        {label}
      </FormLabel>
      <input
        id={id}
        autoComplete="off"
        maxLength={TEXT_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
        {...errorProps(id, error)}
        /* The error ring stays while the field has focus. */
        className={cn(filledField, "aria-invalid:shadow-field-error aria-invalid:focus-visible:shadow-field-error")}
      />
      <FieldError htmlFor={id}>{error}</FieldError>
    </div>
  )
}

/* One value out of a few, as a full-width segmented choice the height of a
   field, so it lines up with the field next to it. */
export function ChoiceField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}): React.ReactElement {
  return (
    <div>
      <FormLabel id={`${id}-label`}>{label}</FormLabel>
      <div
        id={id}
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className="flex h-9 gap-1 rounded-lg bg-input-filled p-0.75"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            tabIndex={value === o.value ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={onRadioKeys}
            /* Sized to the labels first, so "Cancelled" fits in a half row. */
            className="min-w-0 flex-auto cursor-pointer truncate rounded-md px-2 text-btn-ghost-fg text-label-lg outline-none transition-[background-color,color,box-shadow] duration-fast focus-visible:outline-2 focus-visible:outline-ring aria-checked:bg-card aria-checked:text-text-figure aria-checked:shadow-button"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* Notes stay out of the way: an "Add a note" link opens the box. A note
   already saved shows the box straight away. */
export function NoteField({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string
  value: string
  onChange: (text: string) => void
  placeholder?: string
}): React.ReactElement {
  const [shown, setShown] = React.useState(false)
  const boxRef = React.useRef<HTMLTextAreaElement>(null)
  const open = shown || value !== ""

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setShown(true)
            requestAnimationFrame(() => boxRef.current?.focus())
          }}
          className="-ms-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded-md ps-1.5 pe-2 text-btn-ghost-fg text-label-lg outline-none hover:bg-input-filled hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4 [&_svg]:text-icon-muted"
        >
          <Icons.add aria-hidden />
          Add a note
        </button>
      </div>
    )
  }
  return (
    <div>
      <FormLabel htmlFor={id} aside="Optional">
        Notes
      </FormLabel>
      <textarea
        ref={boxRef}
        id={id}
        rows={2}
        maxLength={NOTE_FORM_MAX}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(filledField, "h-auto min-h-14 resize-y py-2")}
      />
    </div>
  )
}
