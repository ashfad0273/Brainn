import { toastManager } from "../components/ui/toast"

/* The one way an app shows a toast, on the Base UI toast engine. Success and
   info close after 4s; an error, or a toast with Undo or Retry, waits for the
   person. Use this rather than toastManager.add directly.
   (First written for Squidx Ledger.) */

export const notify = {
  success(title: string, description?: string) {
    toastManager.add({ type: "success", title, description, timeout: 4000 })
  },
  info(title: string, description?: string) {
    toastManager.add({ type: "info", title, description, timeout: 4000 })
  },
  /* timeout: 0 disables auto-dismiss. Anything carrying an error or a control
     has to wait for the user: reaching Retry or Undo means tabbing from wherever
     focus is into the toast viewport, which a countdown routinely wins — and
     with undo(), losing that race loses the deleted record. The toast's own
     close button is the exit. */
  error(title: string, description?: string) {
    toastManager.add({ type: "error", title, description, timeout: 0 })
  },
  /* Error with a Retry action (devl toasts/error-retry pattern). */
  errorRetry(title: string, description: string, onRetry: () => void) {
    const id: string = toastManager.add({
      type: "error",
      title,
      description,
      timeout: 0,
      actionProps: { children: "Retry", onClick: once((): string => id, onRetry) },
    })
  },
  /* Success with an Undo action (devl toasts/undo pattern). */
  undo(title: string, description: string, onUndo: () => void) {
    const id: string = toastManager.add({
      type: "success",
      title,
      description,
      timeout: 0,
      actionProps: { children: "Undo", onClick: once((): string => id, onUndo) },
    })
  },
}

/* Base UI's Toast.Action doesn't close its toast, and these never time out,
   so a used Undo or Retry stayed on screen and could run again: a second
   Undo re-created a deleted category or subscription. The action closes its
   toast and runs once. */
function once(id: () => string, run: () => void): () => void {
  let done = false
  return () => {
    toastManager.close(id())
    if (done) return
    done = true
    run()
  }
}
