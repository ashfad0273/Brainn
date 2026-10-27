import type * as React from "react"
import { Modal } from "../ui/modal"

/* The one "are you sure?" dialog, on the small (400px) Modal frame. Title and
   button say the same verb ("Delete account" / "Delete account"); the
   description names the thing and what happens next ("You can undo right
   after."). `tone="destructive"` (the default) paints the confirm button red;
   use "default" for a reversible step. Closes on Cancel, Esc, the scrim or
   the close button; the caller closes it after `onConfirm` resolves, or keeps
   it open with `pending` while the request runs. Focus starts on the confirm
   button. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  pending = false,
  tone = "destructive",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void | Promise<unknown>
  pending?: boolean
  tone?: "destructive" | "default"
}) {
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      size="sm"
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      submitLabel={confirmLabel}
      danger={tone === "destructive"}
      pending={pending}
      onSubmit={() => void onConfirm()}
    />
  )
}
