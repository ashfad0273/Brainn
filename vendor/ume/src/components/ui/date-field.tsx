"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";
import { Icons } from "../../lib/icons";
import { cn } from "../../lib/utils";

/* Filled fields and the typed date (component sheet: the Add a transaction and
   Transfer forms).

     import { DateField, FilledInput, MoneyField, filledField } from "./date-field";

     <label htmlFor="entry-date">Date</label>
     <DateField id="entry-date" value={date} onChange={setDate} aria-invalid={!!err} />

     <FilledInput id="notes" placeholder="Why it moved" />
     <MoneyField id="cost" placeholder="0" unit="/month" />
     <button type="button" className={filledField}>…</button>   // a picker trigger

   filledField / FilledInput — the login field family at 36px for in-app
   forms: --input-filled, 10px radius, Body Medium (15/22) in text-figure,
   placeholder in --text-tertiary, a 16px muted icon if one sits inside. Focus
   draws a 2px card gap, then a 1.5px --foreground ring (shadow-field-focus).
   FilledInput takes every <input> prop.

   DateField — props: value (ISO "YYYY-MM-DD", or "" for none), onChange(iso),
   id?, aria-invalid?, aria-describedby?, placeholder? ("DD/MM/YYYY"),
   disabled?, className? (on the field).
   - The value is typed as DD/MM/YYYY; slashes go in as the digits arrive.
     onChange gets the ISO date once the typing makes a real one, and "" while
     it doesn't, so a half-typed date never reaches the form as valid.
   - A complete but impossible date (31/02/2026) draws the error ring
     (--field-error, rose) and sets aria-invalid; so does aria-invalid from
     the caller.
   - The calendar button on the right opens a one-month popover under the
     field: the month in grey, prev / next, a Monday-first grid with the
     weekday letters in Label Mono. The selected day is a dark square
     (--btn-primary-bg), today is underlined, a hovered day is a card square
     with a 1.5px --foreground line, other months' days are grey. Esc or a
     click outside closes it; picking a day closes it and returns focus to the
     input. */

export const filledField =
  "flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border-0 bg-input-filled px-3 font-medium text-sm text-text-figure tabular-nums outline-none transition-shadow duration-fast placeholder:text-text-tertiary focus-visible:shadow-field-focus [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-icon-muted";

export function FilledInput({
  className,
  ...props
}: React.ComponentProps<"input">): React.ReactElement {
  return <input className={cn(filledField, className)} data-slot="filled-input" {...props} />;
}

/* A money field in the same family: ৳ in grey before the figure and an
   optional unit after it in grey Label ("/month", spelled out). Takes every <input> prop;
   aria-invalid draws the error ring. */
export function MoneyField({
  unit,
  className,
  ...props
}: React.ComponentProps<"input"> & { unit?: string }): React.ReactElement {
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true";
  return (
    <div
      className={cn(filledField, invalid ? "shadow-field-error" : "focus-within:shadow-field-focus", className)}
      data-slot="money-field"
    >
      <span aria-hidden translate="no" className="text-text-secondary">
        ৳
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        {...props}
        className="min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-text-tertiary"
      />
      {unit ? <span className="shrink-0 text-text-secondary text-xs">{unit}</span> : null}
    </div>
  );
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/* "2026-08-23" → a local Date, or null. */
function fromISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getDate() === +m[3] && d.getMonth() === +m[2] - 1 ? d : null;
}

/* "2026-08-23" → "23/08/2026". */
function isoToText(iso: string): string {
  const d = fromISO(iso);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "";
}

/* "23/08/2026" → "2026-08-23", or null while it isn't a real date. */
function textToISO(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  return m ? (fromISO(`${m[3]}-${m[2]}-${m[1]}`) ? `${m[3]}-${m[2]}-${m[1]}` : null) : null;
}

/* Digits only, slashes after the day and month: "2308" → "23/08". */
function formatDigits(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join("/");
}

export interface DateFieldProps {
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  /* The field's name, when no <label> points at its id. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  /* Submitted with a native form, as the ISO date. */
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateField({
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  name,
  placeholder = "DD/MM/YYYY",
  disabled,
  className,
}: DateFieldProps): React.ReactElement {
  const [text, setText] = React.useState(() => isoToText(value));
  const [open, setOpen] = React.useState(false);
  const fieldRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  /* The last ISO this field reported, so a value prop that only echoes it
     back (or the "" sent while typing) doesn't overwrite the text. */
  const emitted = React.useRef(value);

  React.useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setText(isoToText(value));
    }
  }, [value]);

  const emit = (iso: string) => {
    if (iso === emitted.current) return;
    emitted.current = iso;
    onChange(iso);
  };

  const digits = text.replace(/\D/g, "").length;
  const impossible = digits === 8 && textToISO(text) == null;
  const invalid = impossible || !!ariaInvalid;

  const pick = (d: Date) => {
    const iso = toISO(d);
    setText(isoToText(iso));
    emit(iso);
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <div
        ref={fieldRef}
        className={cn(
          filledField,
          "pe-1",
          invalid ? "shadow-field-error" : "focus-within:shadow-field-focus",
          disabled && "opacity-64",
          className,
        )}
        data-slot="date-field"
      >
        {name && <input type="hidden" name={name} value={value} />}
        <input
          ref={inputRef}
          id={id}
          value={text}
          onChange={(e) => {
            const next = formatDigits(e.target.value);
            setText(next);
            emit(textToISO(next) ?? "");
          }}
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          aria-invalid={invalid || undefined}
          aria-describedby={ariaDescribedBy}
          className="min-w-0 flex-1 border-0 bg-transparent tracking-date outline-none placeholder:text-text-tertiary"
        />
        <PopoverPrimitive.Trigger
          aria-label="Open calendar"
          disabled={disabled}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-icon-muted outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-card aria-expanded:text-foreground [&_svg]:text-current"
        >
          <Icons.date aria-hidden />
        </PopoverPrimitive.Trigger>
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          anchor={fieldRef}
          side="bottom"
          align="start"
          sideOffset={6}
          className="z-50"
        >
          <PopoverPrimitive.Popup
            aria-label="Choose a date"
            finalFocus={inputRef}
            className="flex w-75 flex-col gap-2.5 rounded-popover border border-border-subtle bg-card p-3 text-foreground shadow-pop outline-none"
          >
            <MonthCalendar selected={textToISO(text) ?? value} onPick={pick} />
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/* One month, Monday first, six rows. Mounted on open, so it starts on the
   selected date's month (or this month). The first column's numbers start
   10px in and the last column's end 10px in, matching the month title and
   the next arrow; the columns between are centred (the range picker's
   alignment). */
function MonthCalendar({
  selected,
  onPick,
}: {
  selected: string;
  onPick: (d: Date) => void;
}) {
  const sel = fromISO(selected);
  const today = toISO(new Date());
  const [month, setMonth] = React.useState(() => {
    const d = sel ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const lead = (month.getDay() + 6) % 7;
  const days = Array.from(
    { length: 42 },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), i - lead + 1),
  );
  const step = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const align = (i: number) =>
    i % 7 === 0 ? "justify-items-start ps-2.5" : i % 7 === 6 ? "justify-items-end pe-2.5" : "justify-items-center";

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="ps-2.5 font-medium text-sm text-text-secondary" aria-live="polite">
          {MONTHS[month.getMonth()]} {month.getFullYear()}
        </span>
        <div className="me-1 flex gap-0.5">
          <NavButton label="Previous month" onClick={() => step(-1)}>
            <Icons.chevronLeft aria-hidden className="size-4" />
          </NavButton>
          <NavButton label="Next month" onClick={() => step(1)}>
            <Icons.chevronRight aria-hidden className="size-4" />
          </NavButton>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            aria-hidden
            className={cn("grid h-6 items-center text-label-mono normal-case text-text-secondary", align(i))}
          >
            {w}
          </span>
        ))}
        {days.map((d, i) => {
          const iso = toISO(d);
          const isSel = iso === selected && sel != null;
          const out = d.getMonth() !== month.getMonth();
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(d)}
              aria-pressed={isSel}
              aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
              className={cn(
                "relative isolate grid h-9 cursor-pointer items-center rounded-md font-medium text-sm tabular-nums outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                align(i),
                "after:absolute after:inset-0.5 after:-z-10 after:rounded-md",
                isSel
                  ? "text-btn-primary-fg after:bg-btn-primary"
                  : cn(
                      out ? "text-text-tertiary" : "text-foreground",
                      iso === today && "underline decoration-[1.5px] underline-offset-4",
                      "hover:after:bg-card hover:after:shadow-day-hover",
                    ),
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-grid size-7 cursor-pointer place-items-center rounded-md text-foreground outline-none hover:bg-input-filled focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}
