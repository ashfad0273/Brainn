import * as React from "react"
import { Button } from "../ui/button"
import { ConfirmDialog } from "../patterns/ConfirmDialog"
import { LoadingRows } from "../patterns/LoadingRows"
import { LedgerEmpty } from "../patterns/LedgerSection"
import { RowIconButton } from "../patterns/parts"
import { SettingsRow, SettingsRows, SettingsSection } from "../patterns/SettingsRow"
import { fmtDate } from "../../lib/format"
import { Icons } from "../../lib/icons"
import { notify } from "../../lib/toast"

/* Settings › Profile, after the profile (first built for Squidx Ledger):
   where the account is signed in, one row per device: an icon tile (a phone
   for iOS and Android, a computer otherwise), "{browser} on {os}", where and
   when it was last active, then "This device" or a red sign-out icon. The
   current device comes first. "Sign out other devices" sits under the list.
   Each sign-out asks first, then toasts.

   `devices` is null while loading (two placeholder rows) and "error" when
   the list couldn't load (with Try again, `onRetry`). The app does the
   sign-outs in `onSignOutDevice` and `onSignOutOthers`, then reloads
   `devices` itself; each returns an error message, or nothing when it
   worked. A device sign-out that takes a moment to reach the device returns
   { immediate: false }, and the toast says so. `children` adds the app's own
   sections after this one (passkeys). */

export interface DeviceSession {
  id: string
  browser?: string | null
  os?: string | null
  /* The city it signed in from, when known. */
  place?: string | null
  /* ISO timestamps. */
  signedInAt: string
  lastActiveAt: string
  /* This browser's own session. */
  current?: boolean
}

export type SignOutResult = string | null | void | { error?: string | null; immediate?: boolean }

export interface SecuritySectionProps {
  /* null: loading. "error": couldn't load. */
  devices: DeviceSession[] | null | "error"
  onRetry?: () => void
  onSignOutDevice: (device: DeviceSession) => Promise<SignOutResult>
  /* Without it there is no "Sign out other devices". */
  onSignOutOthers?: () => Promise<string | null | void>
  title?: React.ReactNode
  description?: React.ReactNode
  /* The section heading's id. Default "devices". */
  id?: string
  /* "in 5 minutes" / "5 minutes ago" from an ISO time. Default: Intl's,
     with "just now" under a minute. */
  relativeTime?: (iso: string) => string
  emptyMessage?: string
  /* More sections after this one (passkeys). */
  children?: React.ReactNode
}

/* "5 minutes ago", "yesterday"; "just now" under a minute. */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return String(iso)
  const diff = t - Date.now()
  if (Math.abs(diff) < 60_000) return "just now"
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ]
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit)
  }
  return "just now"
}

export function deviceLabel(device: DeviceSession | null): string {
  if (!device) return "this device"
  return `${device.browser ?? "Unknown browser"} on ${device.os ?? "an unknown device"}`
}

const isPhone = (device: DeviceSession) => /ios|android/i.test(device.os ?? "")

/* The green "This device" pill. */
export function ThisDevice(): React.ReactElement {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-pos-soft px-2 font-medium text-pos-ink text-xs">
      <span aria-hidden className="size-1.5 rounded-full bg-pos" />
      This device
    </span>
  )
}

export function SecuritySection({
  devices,
  onRetry,
  onSignOutDevice,
  onSignOutOthers,
  title = "Signed-in devices",
  description = "Where your account is signed in. Sign out any device you don’t recognise.",
  id = "devices",
  relativeTime: relative = relativeTime,
  emptyMessage = "No devices to show. Each new sign-in shows up here.",
  children,
}: SecuritySectionProps): React.ReactElement {
  const [toRevoke, setToRevoke] = React.useState<DeviceSession | null>(null)
  const [confirmOthers, setConfirmOthers] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  /* The current device first; the rest keep the app's order. */
  const list = React.useMemo(
    () => (Array.isArray(devices) ? [...devices].sort((a, b) => (a.current ? -1 : b.current ? 1 : 0)) : []),
    [devices],
  )
  const hasCurrent = list.some((d) => d.current)
  const othersExist = list.some((d) => !d.current)

  /* "Dhaka · active now"; with no place on record, when it signed in. */
  const meta = (d: DeviceSession) => {
    const where = d.place || `Signed in ${fmtDate(d.signedInAt)}`
    return `${where} · ${d.current ? "active now" : `active ${relative(d.lastActiveAt)}`}`
  }

  const confirmRevoke = async () => {
    if (!toRevoke) return
    setPending(true)
    let result: SignOutResult
    try {
      result = await onSignOutDevice(toRevoke)
    } catch (e) {
      result = e instanceof Error ? e.message : "Try again in a moment."
    }
    setPending(false)
    setToRevoke(null)
    const error = typeof result === "object" && result !== null ? result.error : result
    if (error) {
      notify.error("Couldn’t sign out that device", error)
      return
    }
    const immediate = typeof result === "object" && result !== null ? result.immediate !== false : true
    notify.success("Device signed out", immediate ? undefined : "It can take a couple of minutes to take effect.")
  }

  const confirmRevokeOthers = async () => {
    if (!onSignOutOthers) return
    setPending(true)
    let error: string | null | void
    try {
      error = await onSignOutOthers()
    } catch (e) {
      error = e instanceof Error ? e.message : "Try again in a moment."
    }
    setPending(false)
    setConfirmOthers(false)
    if (error) {
      notify.error("Couldn’t sign out other devices", error)
      return
    }
    notify.success("Other devices signed out")
  }

  const empty =
    devices === "error" ? (
      <div className="flex flex-col items-center gap-3 border-border-subtle/60 border-y py-8">
        <p className="text-sm text-text-secondary">Couldn’t load your devices.</p>
        {onRetry ? (
          <Button variant="quiet" size="md" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    ) : (
      <div className="border-border-subtle/60 border-y py-8">
        <LedgerEmpty message={emptyMessage} />
      </div>
    )

  return (
    <>
      <SettingsSection
        id={id}
        title={title}
        count={Array.isArray(devices) ? devices.length : undefined}
        countLabel={Array.isArray(devices) ? `${devices.length} signed in` : undefined}
        description={description}
      >
        {devices === null ? (
          <LoadingRows rows={2} />
        ) : list.length ? (
          <SettingsRows>
            {list.map((d) => {
              const DeviceIcon = isPhone(d) ? Icons.phone : Icons.system
              return (
                <SettingsRow
                  key={d.id}
                  label={deviceLabel(d)}
                  help={meta(d)}
                  leading={
                    <span
                      aria-hidden
                      className="inline-grid size-8 shrink-0 place-items-center rounded-lg bg-field text-icon-secondary"
                    >
                      <DeviceIcon className="size-4" />
                    </span>
                  }
                >
                  {d.current ? (
                    <ThisDevice />
                  ) : (
                    <RowIconButton destructive label={`Sign out ${deviceLabel(d)}`} onClick={() => setToRevoke(d)}>
                      <Icons.signOut aria-hidden />
                    </RowIconButton>
                  )}
                </SettingsRow>
              )
            })}
          </SettingsRows>
        ) : (
          empty
        )}
        {onSignOutOthers && othersExist && hasCurrent ? (
          <div className="flex pt-4">
            <Button variant="destructive-soft" size="md" onClick={() => setConfirmOthers(true)}>
              <Icons.signOut aria-hidden />
              Sign out other devices
            </Button>
          </div>
        ) : null}
      </SettingsSection>

      {children}

      <ConfirmDialog
        open={!!toRevoke}
        onOpenChange={(o) => !o && setToRevoke(null)}
        title="Sign out device"
        description={`Sign out ${deviceLabel(toRevoke)}? It’s signed out right away and will need to sign in again.`}
        confirmLabel="Sign out device"
        pending={pending}
        onConfirm={confirmRevoke}
      />

      <ConfirmDialog
        open={confirmOthers}
        onOpenChange={setConfirmOthers}
        title="Sign out all other devices"
        description="Every device except this one is signed out right away and will need to sign in again."
        confirmLabel="Sign out others"
        pending={pending}
        onConfirm={confirmRevokeOthers}
      />
    </>
  )
}
