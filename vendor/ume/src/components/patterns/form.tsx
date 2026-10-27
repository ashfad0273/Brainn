import type * as React from "react"
import { type Icon } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* Form parts every form shares: the field label, the radio-group arrow keys,
   the `--c` tint and the two-way switch at the top of a form. */

/* `--c` for the tint-selected / swatch-ring utilities (index.css). */
export const tint = (color: string) => ({ "--c": color }) as React.CSSProperties

/* Arrow keys move the choice within a radio group, as native radios do. */
export function onRadioKeys(e: React.KeyboardEvent<HTMLElement>) {
  const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[e.key]
  if (!step) return
  const radios = Array.from(
    e.currentTarget.parentElement?.querySelectorAll<HTMLElement>(':scope > [role="radio"]:not(:disabled)') ?? [],
  )
  const next = radios[(radios.indexOf(e.currentTarget) + step + radios.length) % radios.length]
  if (!next) return
  e.preventDefault()
  next.focus()
  next.click()
}

/* The sheet's field label: Label Medium (13px, 500) in grey, an optional
   note on the right ("Optional") in Medium in a lighter grey. A plain
   caption (no control to point at) when there is no htmlFor. */
export function FormLabel({
  htmlFor,
  id,
  aside,
  className,
  children,
}: {
  htmlFor?: string
  id?: string
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  const cls = cn("mb-1.5 flex items-baseline justify-between gap-3 px-0.5 font-medium text-text-secondary text-xs", className)
  const note = aside ? <span className="text-text-tertiary">{aside}</span> : null
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className={cls}>
      <span>{children}</span>
      {note}
    </label>
  ) : (
    <div id={id} className={cls}>
      <span>{children}</span>
      {note}
    </div>
  )
}

/* The two big tinted buttons on their own, for any two-way choice at the
   top of a form (Team / Client on People). */
export function TypeSwitch<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id?: string
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; icon: Icon; hue: string; ink: string }>
  onChange: (value: T) => void
}) {
  return (
    <div id={id} role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map((t) => {
        const on = value === t.value
        return (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={onRadioKeys}
            style={tint(t.hue)}
            className={cn(
              "flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border font-medium text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4",
              on
                ? cn("tint-selected [&_svg]:text-current", t.ink)
                : "border-border-subtle bg-card text-text-secondary hover:border-border-hover hover:text-foreground [&_svg]:text-icon-muted",
            )}
          >
            <t.icon aria-hidden />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
