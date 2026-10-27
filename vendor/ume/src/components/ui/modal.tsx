"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import * as React from "react";
import { Button } from "./button";
import { Icons } from "../../lib/icons";
import { cn } from "../../lib/utils";

/* Modal: the approved modal frame (component sheet "3 · Modal", the Accounts
   Transfer dialog). A Base UI Dialog, so focus is trapped, Esc and a click on
   the scrim close it, and the title and description label it.

     import { Modal } from "./modal";

     <Modal
       open={open}
       onOpenChange={setOpen}
       title="Transfer"
       description="Move money from one account to another."
       onSubmit={save}          // body + footer become one <form>; Enter submits
       submitLabel="Save"       // default "Save"
       cancelLabel="Cancel"     // default "Cancel"; closes the modal
       pending={saving}         // spinner on Save
       danger                   // Save in red, for a delete
       dirty={hasEdits}         // dismissing asks "Discard changes?" first
     >
       …fields…
     </Modal>

   Props: open, onOpenChange(open), title, description?, children?,
   onSubmit?, submitLabel?, cancelLabel?, pending?, danger?, dirty?, size?,
   hideCancel?, initialFocus?, className? (on the card).
   Without onSubmit the footer shows only Cancel (a read-only view).

   Every form gets the discard guard from `dirty`: pass true while the form
   holds edits (useFormValues' `dirty` in dialogs/form-parts does this).

   The small frame (`size="sm"`, 400px) is for confirms and short forms:
   Change password, Delete account, Discard changes?, Still there?. A confirm
   has no children, so it is the title, its sentence and the two buttons.
   `danger` paints Save red; `hideCancel` leaves the one button.

   Frame —
   - the card: --card, a --border-subtle hairline, 24px radius (rounded-3xl),
     the pop shadow; at most 520px wide, centred on a --modal-scrim with 16px
     around it. It fades and rises 8px in over `base`.
   - header (20 20 0 24): the title in the Title style (17/24 Medium,
     text-figure), an optional description under it in grey Body (15/22
     Regular), and a 32px round close button with Icons.close.
   - body (16 24 24): a column with 20px between fields.
   - `under` (optional): a slot right under the title row, before the body:
     the Add a transaction amount + type toggle, the Add a person tabs.
   - footer (0 24 24, 20 on top in a confirm): lg Cancel (secondary) and
     Save (primary), right-aligned and sized to their labels. Never a divider
     or hairline above the buttons.
   - phones (under 640px): 16px side padding in the body and footer, 16 / 12
     in the header.

   `dirty` turns on the discard guard: while the form holds edits, Esc, the
   scrim and the close button open "Discard changes?" (this same frame,
   small, over a lighter second scrim) before throwing them away. Cancel and
   a finished save close directly (the caller sets open=false itself, which
   never goes through the guard). */

/* Close requests that come from the user dismissing the modal. Only these
   are guarded. */
const GUARDED_REASONS = new Set<string>([
  "outside-press",
  "escape-key",
  "close-press",
  "close-watcher",
  "focus-out",
]);

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /* None for a confirm: the title and description say it all. */
  children?: React.ReactNode;
  /* When set, the body and footer are one <form> and the footer shows Save. */
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  /* The submit button in the destructive red (Delete). */
  danger?: boolean;
  /* The form holds edits that a dismissal would lose. */
  dirty?: boolean;
  /* "sm": the 400px frame for confirms and short forms; "narrow": the 420px
     frame for short two-column forms (Transfer, Add a subscription). */
  size?: "md" | "narrow" | "sm";
  /* Drawn between the title row and the body (tabs, a centred amount). */
  under?: React.ReactNode;
  /* Only Save in the footer (Still there?). */
  hideCancel?: boolean;
  /* Opened from another modal: a lighter second scrim. Set by the guard. */
  nested?: boolean;
  /* Where focus lands on open (Base UI's initialFocus); default: the first
     focusable element, or Save in a confirm (no children). "submit" puts it
     on Save. */
  initialFocus?: React.ComponentProps<typeof DialogPrimitive.Popup>["initialFocus"] | "submit";
  className?: string;
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  pending = false,
  danger = false,
  dirty = false,
  size = "md",
  hideCancel = false,
  under,
  nested = false,
  initialFocus,
  className,
}: ModalProps): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const submitRef = React.useRef<HTMLButtonElement>(null);

  /* A guard left open by a modal that then closed some other way must not
     reappear the next time it opens. */
  React.useEffect(() => {
    if (!open) setConfirmOpen(false);
  }, [open]);

  const requestOpenChange = (
    next: boolean,
    details?: { reason?: string; cancel?: () => void },
  ) => {
    if (!next && dirty && details?.reason && GUARDED_REASONS.has(details.reason)) {
      details.cancel?.();
      setConfirmOpen(true);
      return;
    }
    onOpenChange(next);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={requestOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          forceRender={nested}
          className={cn(
            "fixed inset-0 z-50 transition-opacity duration-base ease-out data-ending-style:opacity-0 data-starting-style:opacity-0",
            nested ? "bg-modal-scrim-nested" : "bg-modal-scrim",
          )}
          data-slot="modal-backdrop"
        />
        <DialogPrimitive.Viewport
          className="fixed inset-0 z-50 grid grid-cols-[minmax(0,520px)] place-items-center justify-center overflow-y-auto px-4 pt-[max(--spacing(4),env(safe-area-inset-top))] pb-[max(--spacing(4),env(safe-area-inset-bottom))]"
          data-slot="modal-viewport"
        >
          <DialogPrimitive.Popup
            className={cn(
              "flex w-full flex-col rounded-3xl border border-border-subtle bg-card text-foreground shadow-pop outline-none transition-[opacity,translate,scale] duration-base ease-out data-ending-style:translate-y-2 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:translate-y-2 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
              size === "sm" && "max-w-100",
              size === "narrow" && "max-w-105",
              className,
            )}
            data-slot="modal"
            /* A confirm has nothing to type, so focus starts on its button. */
            initialFocus={
              initialFocus === "submit" || (!initialFocus && !children) ? submitRef : initialFocus
            }
            render={
              onSubmit ? (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    /* React bubbles through portals: a nested modal's submit
                       must not reach the form it was opened from. */
                    e.stopPropagation();
                    onSubmit();
                  }}
                />
              ) : undefined
            }
          >
            <div className="flex items-start justify-between gap-3 pt-5 ps-6 pe-5 max-sm:ps-4 max-sm:pe-3">
              <div>
                <DialogPrimitive.Title className="font-medium text-lg text-text-figure">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-0.5 text-sm text-text-secondary">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close
                aria-label="Close"
                className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full border border-border-subtle bg-card text-foreground shadow-button outline-none hover:border-(--neutral-72) focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <Icons.close aria-hidden className="size-4" />
              </DialogPrimitive.Close>
            </div>
            {under}
            {/* A confirm (title, line, buttons) has no body. */}
            {children ? (
              <div className="flex flex-col gap-5 px-6 pt-4 pb-6 max-sm:px-4" data-slot="modal-body">
                {children}
              </div>
            ) : null}
            <div
              className={cn(
                "flex justify-end gap-2 px-6 pb-6 max-sm:px-4",
                !children ? "pt-5" : "pt-0",
              )}
              data-slot="modal-footer"
            >
              {hideCancel ? null : (
                <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
                  {cancelLabel}
                </Button>
              )}
              {onSubmit ? (
                <Button
                  ref={submitRef}
                  type="submit"
                  variant={danger ? "destructive" : "primary"}
                  size="lg"
                  loading={pending}
                >
                  {submitLabel}
                </Button>
              ) : null}
            </div>

            {/* Nested in the dialog's tree so Base UI treats it as a child:
                focus moves into it and Esc closes only it. Only a form that
                can be dirty carries one (the guard itself never does). */}
            {dirty || confirmOpen ? (
              <Modal
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                size="sm"
                nested
                title="Discard changes?"
                description="What you typed in this form will be lost."
                cancelLabel="Keep editing"
                submitLabel="Discard"
                danger
                onSubmit={() => {
                  setConfirmOpen(false);
                  onOpenChange(false);
                }}
              />
            ) : null}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
