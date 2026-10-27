import type * as React from "react"
import { Badge } from "../ui/badge"

/* Every record status the app shows, mapped once to a Badge variant and a
   plain-words label, so "Cancelled" and "Inactive" can't end up in different
   colours on different pages:
   - positive (success): active, paid, success
   - neutral (secondary): paused, cancelled, inactive, past
   - negative (error): overdue, failed, failure
   - waiting (warning): pending, scheduled */
const STATUS = {
  active: { variant: "success", label: "Active" },
  paid: { variant: "success", label: "Paid" },
  success: { variant: "success", label: "Finished" },
  paused: { variant: "secondary", label: "Paused" },
  cancelled: { variant: "secondary", label: "Cancelled" },
  inactive: { variant: "secondary", label: "Inactive" },
  past: { variant: "secondary", label: "Past client" },
  overdue: { variant: "error", label: "Overdue" },
  failed: { variant: "error", label: "Failed" },
  failure: { variant: "error", label: "Failed" },
  pending: { variant: "warning", label: "Pending" },
  scheduled: { variant: "warning", label: "Scheduled" },
} as const satisfies Record<string, { variant: "success" | "secondary" | "error" | "warning"; label: string }>

export type Status = keyof typeof STATUS

/* A status pill. Unknown statuses fall back to a quiet outline badge with the
   raw value capitalised, so a new status never crashes a list. Vibrant: a
   soft pill with ink text and a solid dot, one hue per meaning. Pass
   `children` to override the label ("Past client" vs "Inactive"). */
export function StatusBadge({
  status,
  children,
  icon,
  dot = true,
  size = "sm",
}: {
  status: Status | (string & {})
  children?: React.ReactNode
  /* An optional 12px icon before the label. */
  icon?: React.ReactNode
  /* Status dot in the meaning's solid hue (on by default; off when an icon
     is given). */
  dot?: boolean
  size?: "sm" | "default"
}) {
  const known = (STATUS as Record<string, { variant: string; label: string } | undefined>)[status]
  const variant = (known?.variant ?? "outline") as
    | "success"
    | "secondary"
    | "error"
    | "warning"
    | "outline"
  const label = children ?? known?.label ?? status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <Badge variant={variant} size={size} dot={dot && !icon}>
      {icon}
      {label}
    </Badge>
  )
}
