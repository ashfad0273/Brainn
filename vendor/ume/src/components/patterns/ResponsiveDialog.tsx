import * as React from "react"
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../ui/alert-dialog"
import { Button } from "../ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog"
import {
  Drawer,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "../ui/drawer"
import { useIsMobileNav } from "../../hooks/use-media-query"
import { cn } from "../../lib/utils"

/* One shell for every form dialog: a centred dialog on desktop, a bottom
   drawer on phones and tablets (the nav breakpoint), with the same header,
   scrolling body and footer either way. Add and edit flows open identically,
   so an entry edited on a phone rises from the bottom just like a new one.

   `dirty` turns on the discard guard: while the form holds unsaved edits, a
   click outside, Esc, the close button or a swipe-down asks "Discard
   changes?" instead of throwing the typing away. Cancel and a successful
   save close directly — the caller calls onOpenChange(false) itself, which
   never goes through the guard. */

/* Close requests that come from the user dismissing the surface (as opposed
   to the app closing it after a save). Only these are guarded. */
const GUARDED_REASONS = new Set<string>([
  "outside-press",
  "escape-key",
  "close-press",
  "close-watcher",
  "focus-out",
  "swipe",
])

/* 16px text on phone inputs stops iOS zooming in on focus; h-11 gives a 44px
   touch target. Every form dialog spreads these on its controls. */
export function useTouchFields(): {
  isMobile: boolean
  touchCls: string | undefined
  textCls: string | undefined
} {
  const isMobile = useIsMobileNav()
  return {
    isMobile,
    touchCls: isMobile ? "h-11 text-base" : undefined,
    textCls: isMobile ? "text-base" : undefined,
  }
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  dirty = false,
  onSubmit,
  submitLabel = "Save",
  pending = false,
  cancelLabel = "Cancel",
  footerStart,
  size = "md",
  bodyClassName,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  /* The form holds edits that a dismissal would lose. */
  dirty?: boolean
  /* When set, the body and footer are one <form>; Enter in a field submits.
     Without it the footer shows only the cancel button (read-only views). */
  onSubmit?: () => void
  submitLabel?: string
  pending?: boolean
  cancelLabel?: string
  /* Extra footer actions on the leading edge, e.g. a Delete button. */
  footerStart?: React.ReactNode
  size?: "sm" | "md"
  bodyClassName?: string
  children: React.ReactNode
}): React.ReactElement {
  const isMobile = useIsMobileNav()
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  /* A guard left open by a dialog that then closed some other way (a save
     finishing) must not reappear the next time the dialog opens. */
  React.useEffect(() => {
    if (!open) setConfirmOpen(false)
  }, [open])

  const requestOpenChange = (
    next: boolean,
    details?: { reason?: string; cancel?: () => void },
  ) => {
    if (next) {
      onOpenChange(true)
      return
    }
    if (dirty && details?.reason && GUARDED_REASONS.has(details.reason)) {
      details.cancel?.()
      setConfirmOpen(true)
      return
    }
    onOpenChange(false)
  }

  const discard = () => {
    setConfirmOpen(false)
    onOpenChange(false)
  }

  /* Nested inside the dialog's own tree so Base UI treats it as a child
     dialog: focus moves into it, Esc closes only it, and a click on it is
     not an outside click on the form underneath. */
  const discardGuard = (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogPopup className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Discard changes?</AlertDialogTitle>
          <AlertDialogDescription>
            What you typed in this form will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogClose
            render={<Button variant="secondary" size="lg" />}
          >
            Keep editing
          </AlertDialogClose>
          <Button
            variant="destructive"
            size="lg"
            onClick={discard}
          >
            Discard
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  )

  /* Modal footers: Cancel and Save use the lg button on every screen, with
     no divider above them (DialogFooter's default), as in Modal. */
  const buttonSize = "lg"
  const footerButtons = (
    <>
      {footerStart}
      <Button
        type="button"
        variant="secondary"
        size={buttonSize}
        onClick={() => onOpenChange(false)}
      >
        {cancelLabel}
      </Button>
      {onSubmit ? (
        <Button
          type="submit"
          size={buttonSize}
          /* Grow only in the side-by-side footer (tablet); in the stacked phone
             footer flex-1 would collapse the button height. */
          className={isMobile ? "sm:flex-1" : undefined}
          loading={pending}
        >
          {submitLabel}
        </Button>
      ) : null}
    </>
  )

  const wrap = (content: React.ReactNode) =>
    onSubmit ? (
      <form
        className="contents"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        {content}
      </form>
    ) : (
      content
    )

  const body = cn("flex flex-col gap-4", bodyClassName)

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={requestOpenChange} position="bottom">
        <DrawerPopup showBar>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          {wrap(
            <>
              <DrawerPanel className={body}>{children}</DrawerPanel>
              <DrawerFooter variant="bare">{footerButtons}</DrawerFooter>
            </>,
          )}
          {discardGuard}
        </DrawerPopup>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogPopup className={size === "sm" ? "max-w-sm" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {wrap(
          <>
            <DialogPanel className={body}>{children}</DialogPanel>
            <DialogFooter>{footerButtons}</DialogFooter>
          </>,
        )}
        {discardGuard}
      </DialogPopup>
    </Dialog>
  )
}
