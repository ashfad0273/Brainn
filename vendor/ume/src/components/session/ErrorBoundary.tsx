import * as React from "react"
import { ErrorPage, type ErrorPageKind } from "./ErrorPage"

/* A render-crash boundary that shows an ErrorPage instead of blanking the
   app (first built for Squidx Ledger). Put one around the whole app
   (`fullPage`: "{appName} couldn't start" on the canvas, with Reload) and
   one around each page inside the shell, keyed by the path so one broken
   page doesn't poison the others; that one keeps the page's `topbar` above
   "This page couldn't load", with Try again.

   A failed chunk load (a tab left open across a deploy) shows "A newer
   version is ready" with Reload instead: retrying in place can't succeed,
   because React.lazy keeps the failed import. `onError` runs first; return
   true from it when the app has handled the error itself (it started a
   reload) and the boundary shows nothing rather than flash a message.
   `isReloading` is read on every render for the same reason, since the
   message would otherwise paint before onError runs. Without an onError
   that returns true, the error goes to the console, where the stack trace
   is useful; the page shows no exception text. */

/* Chunk-load failures as each browser words them, plus Vite's CSS preload. */
const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk .* failed|ChunkLoadError/i

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === "ChunkLoadError" || CHUNK_ERROR.test(error.message)
}

export interface ErrorBoundaryProps {
  children: React.ReactNode
  /* The app-level boundary, outside the shell: the "screen" frame. */
  fullPage?: boolean
  /* The crashed page's own topbar, kept above the message (not fullPage). */
  topbar?: React.ReactNode
  /* In "{appName} couldn't start". Default "The app". */
  appName?: string
  /* Called after Try again clears the error. */
  onReset?: () => void
  /* Reload, on the update and couldn't-start pages. Default: reload the page. */
  onReload?: () => void
  /* Runs when an error is caught. Return true when the app has handled it
     (a reload is under way): the boundary then renders nothing. */
  onError?: (error: Error, info: React.ErrorInfo) => boolean | void
  /* True while the app is reloading: render nothing instead of a message. */
  isReloading?: () => boolean
  /* Which errors mean "a newer version is ready". Default isChunkLoadError. */
  isUpdateError?: (error: Error) => boolean
  /* Draws something else in place of the ErrorPage. */
  fallback?: (args: { error: Error; kind: ErrorPageKind; reset: () => void }) => React.ReactNode
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { error: Error | null; handled: boolean }
> {
  state = { error: null as Error | null, handled: false }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (this.props.isReloading?.()) return
    if (this.props.onError?.(error, info) === true) {
      this.setState({ handled: true })
      return
    }
    console.error(error, info)
  }

  reset = () => {
    this.setState({ error: null, handled: false })
    this.props.onReset?.()
  }

  render() {
    const { error, handled } = this.state
    const { fullPage, topbar, appName, onReload, isReloading, isUpdateError = isChunkLoadError, fallback } = this.props
    if (!error) return this.props.children
    if (handled || isReloading?.()) return null
    const kind: ErrorPageKind = isUpdateError(error) ? "update-ready" : fullPage ? "start-failed" : "load-failed"
    if (fallback) return fallback({ error, kind, reset: this.reset })
    return (
      <ErrorPage
        kind={kind}
        appName={appName}
        frame={fullPage ? "screen" : "page"}
        topbar={topbar}
        onRetry={this.reset}
        onReload={onReload}
      />
    )
  }
}
