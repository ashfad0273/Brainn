import * as React from "react"
import { filledField } from "../ui/date-field"
import { Modal } from "../ui/modal"
import { FormLabel } from "../patterns/form"
import { FieldError, errorProps, useFormValues } from "../patterns/form-parts"
import { useIsMobileNav } from "../../hooks/use-media-query"
import { Icons } from "../../lib/icons"
import { notify } from "../../lib/toast"
import { cn } from "../../lib/utils"

/* Change password (first built for Squidx Ledger), on the small Modal
   frame: the new password and the same again, each with a show / hide
   button inside, and optionally the current one above them. The app does
   the change in `onSubmit` and returns an error message, or nothing.

   Checks run beside the field that failed, not in a toast: a toast isn't
   tied to the control and isn't read as its description. What the server
   says goes in a toast ("Couldn't update password", its message). After a
   save: "Password updated", the dialog closes, then `afterSave`. The same
   dialog with other copy (title, intro, cta) sets a password after a reset
   link. */

export type PasswordSubmit = (values: { next: string; current?: string }) => Promise<string | null | void> | string | null | void

export interface PasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /* Makes the change; returns an error message, or null when it worked. A
     throw counts as an error too. */
  onSubmit: PasswordSubmit
  /* Ask for the current password first. */
  requireCurrent?: boolean
  /* Shortest password allowed. Default 8. */
  minLength?: number
  title?: string
  intro?: string
  cta?: string
  afterSave?: () => void
}

export function PasswordDialog({
  open,
  onOpenChange,
  onSubmit,
  requireCurrent = false,
  minLength = 8,
  title = "Change password",
  intro = "You stay signed in on this device.",
  cta = "Update password",
  afterSave,
}: PasswordDialogProps): React.ReactElement {
  const isMobile = useIsMobileNav()
  const firstRef = React.useRef<HTMLInputElement>(null)
  const [pending, setPending] = React.useState(false)
  const form = useFormValues({ open, seed: () => ({ current: "", pw1: "", pw2: "" }) })
  const { current, pw1, pw2 } = form.values

  const submit = async () => {
    const errs: { current?: string; pw1?: string; pw2?: string } = {}
    if (requireCurrent && !current) errs.current = "Enter the password you sign in with now."
    if (pw1.length < minLength) errs.pw1 = `Choose a password with at least ${minLength} characters.`
    else if (pw1 !== pw2) errs.pw2 = "The two passwords don’t match. Type the same one in both."
    if (form.fail(errs, { current: "pw-current", pw1: "pw-new", pw2: "pw-confirm" })) return
    setPending(true)
    let err: string | null | void
    try {
      err = await onSubmit({ next: pw1, current: requireCurrent ? current : undefined })
    } catch (e) {
      err = e instanceof Error ? e.message : "Try again in a moment."
    }
    setPending(false)
    if (err) {
      notify.error("Couldn’t update password", err)
      return
    }
    notify.success("Password updated")
    onOpenChange(false)
    afterSave?.()
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={intro}
      size="sm"
      dirty={form.dirty}
      onSubmit={() => void submit()}
      submitLabel={cta}
      pending={pending}
      initialFocus={isMobile ? undefined : firstRef}
    >
      {requireCurrent ? (
        <PasswordField
          ref={firstRef}
          id="pw-current"
          label="Current password"
          placeholder="The one you sign in with"
          autoComplete="current-password"
          value={current}
          onChange={(t) => form.set("current", t)}
          error={form.errors.current}
        />
      ) : null}
      <PasswordField
        ref={requireCurrent ? undefined : firstRef}
        id="pw-new"
        label="New password"
        placeholder={`At least ${minLength} characters`}
        value={pw1}
        onChange={(t) => form.set("pw1", t)}
        error={form.errors.pw1}
      />
      <PasswordField
        id="pw-confirm"
        label="Confirm password"
        placeholder="Type it again"
        value={pw2}
        onChange={(t) => form.set("pw2", t)}
        error={form.errors.pw2}
      />
    </Modal>
  )
}

/* A filled password field with its label above, a show / hide button inside
   on the right, and its error under it. */
export function PasswordField({
  ref,
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  autoComplete = "new-password",
}: {
  ref?: React.Ref<HTMLInputElement>
  id: string
  label: string
  placeholder?: string
  value: string
  onChange: (text: string) => void
  error?: string
  autoComplete?: "new-password" | "current-password"
}): React.ReactElement {
  const [shown, setShown] = React.useState(false)
  const Eye = shown ? Icons.hide : Icons.show
  return (
    <div>
      <FormLabel htmlFor={id}>{label}</FormLabel>
      <div className={cn(filledField, "pe-1", error ? "shadow-field-error" : "focus-within:shadow-field-focus")}>
        <input
          ref={ref}
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-text-tertiary placeholder:tracking-normal",
            !shown && value && "tracking-password",
          )}
          {...errorProps(id, error)}
        />
        <button
          type="button"
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-icon-muted outline-none hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [&_svg]:text-current"
        >
          <Eye aria-hidden />
        </button>
      </div>
      <FieldError htmlFor={id}>{error}</FieldError>
    </div>
  )
}
