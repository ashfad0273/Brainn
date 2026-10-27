import * as React from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { SettingsRow, SettingsRows, SettingsSection } from "../patterns/SettingsRow"
import { PasswordDialog, type PasswordSubmit } from "./PasswordDialog"
import { Icons } from "../../lib/icons"
import { notify } from "../../lib/toast"

/* Settings › Profile, the first section (first built for Squidx Ledger):
   the display name, the sign-in email (read-only) and Change password, on
   SettingsRows. The name's Save shows only once the name changes: Enter
   saves, Esc puts the saved name back, and a green "Saved" stays beside the
   field for 2 seconds after. A name the app updates (another tab, a reload)
   replaces the field's text only while nothing is typed in it.

   The app saves in `onSaveName` and changes the password in
   `onUpdatePassword` (the section opens PasswordDialog); each returns an
   error message, or nothing when it worked. Without `onUpdatePassword` the
   password row is left out. `avatar` sits before the name row's label, and
   `children` adds the app's own rows under the password. */

export interface ProfileSectionProps {
  /* The saved display name; "" when there is none yet. */
  name: string
  /* Saves the name (already trimmed and cut to nameMax); returns an error
     message, or null when it worked. */
  onSaveName: (name: string) => Promise<string | null | void>
  nameMax?: number
  nameHelp?: React.ReactNode
  email: string
  emailHelp?: React.ReactNode
  /* Changes the password from PasswordDialog. */
  onUpdatePassword?: PasswordSubmit
  /* PasswordDialog asks for the current password first. */
  requireCurrentPassword?: boolean
  passwordHelp?: React.ReactNode
  /* An avatar before the name row's label (InitialsAvatar). */
  avatar?: React.ReactNode
  /* A section title and description; a tab that is only this leaves them out. */
  title?: React.ReactNode
  description?: React.ReactNode
  /* The ids start with this: "{idPrefix}-name", "{idPrefix}-email". */
  idPrefix?: string
  /* More rows, after the password row. */
  children?: React.ReactNode
}

export function ProfileSection({
  name: savedName,
  onSaveName,
  nameMax = 80,
  nameHelp = "Shown beside what you add.",
  email,
  emailHelp = "You sign in with this.",
  onUpdatePassword,
  requireCurrentPassword = false,
  passwordHelp = "Change the password you sign in with.",
  avatar,
  title,
  description,
  idPrefix = "profile",
  children,
}: ProfileSectionProps): React.ReactElement {
  const [pwOpen, setPwOpen] = React.useState(false)
  const [justSaved, setJustSaved] = React.useState(false)
  const [name, setName] = React.useState(savedName)
  const [baseline, setBaseline] = React.useState(savedName)
  const [saving, setSaving] = React.useState(false)
  const dirty = name.trim() !== baseline

  React.useEffect(() => {
    if (dirty) return
    setName(savedName)
    setBaseline(savedName)
  }, [savedName, dirty])

  const save = async () => {
    const trimmed = name.trim().slice(0, nameMax)
    setSaving(true)
    let error: string | null | void
    try {
      error = await onSaveName(trimmed)
    } catch (e) {
      error = e instanceof Error ? e.message : "Try again in a moment."
    }
    setSaving(false)
    if (error) {
      /* A message that only repeats the title says nothing under it. */
      notify.error(
        "Couldn’t save your name",
        /^Couldn[’']t save your name\.?$/.test(error) ? "Try again in a moment." : error,
      )
      return
    }
    setName(trimmed)
    setBaseline(trimmed)
    setJustSaved(true)
    notify.success("Display name saved")
  }

  React.useEffect(() => {
    if (!justSaved) return
    const t = window.setTimeout(() => setJustSaved(false), 2000)
    return () => window.clearTimeout(t)
  }, [justSaved])

  const nameId = `${idPrefix}-name`

  return (
    <SettingsSection id={title ? `${idPrefix}-title` : undefined} title={title} description={description}>
      <SettingsRows>
        <SettingsRow label="Display name" htmlFor={nameId} help={nameHelp} leading={avatar}>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <Input
              id={nameId}
              variant="quiet"
              className="w-full sm:w-44"
              placeholder="Your name"
              autoComplete="off"
              value={name}
              maxLength={nameMax}
              onChange={(e) => {
                setName(e.target.value)
                setJustSaved(false)
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && dirty && !saving) void save()
                if (e.key === "Escape" && dirty) {
                  e.preventDefault()
                  setName(baseline)
                }
              }}
              nativeInput
            />
            {justSaved && !dirty ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 font-medium text-pos text-xs">
                <Icons.check aria-hidden className="size-4" />
                Saved
              </span>
            ) : null}
            {dirty ? (
              <Button type="button" loading={saving} onClick={() => void save()}>
                Save
              </Button>
            ) : null}
          </div>
        </SettingsRow>
        <SettingsRow label="Email" labelId={`${idPrefix}-email`} help={emailHelp}>
          <span translate="no" className="break-all text-end font-medium text-sm">
            {email}
          </span>
        </SettingsRow>
        {onUpdatePassword ? (
          <SettingsRow label="Password" help={passwordHelp}>
            <Button variant="quiet" type="button" onClick={() => setPwOpen(true)}>
              <Icons.key aria-hidden />
              Change password
            </Button>
          </SettingsRow>
        ) : null}
        {children}
      </SettingsRows>
      {onUpdatePassword ? (
        <PasswordDialog
          open={pwOpen}
          onOpenChange={setPwOpen}
          onSubmit={onUpdatePassword}
          requireCurrent={requireCurrentPassword}
        />
      ) : null}
    </SettingsSection>
  )
}
