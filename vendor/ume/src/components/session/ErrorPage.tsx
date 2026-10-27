import * as React from "react"
import { Button } from "../ui/button"
import { BlankState } from "../patterns/BlankState"
import { Illustration } from "../illustrations/Illustration"
import type { HairlineFigure } from "../illustrations/hairline-kernel.js"
import drawer from "../illustrations/drawer.js"
import engine from "../illustrations/engine.js"
import server from "../illustrations/server.js"
import sheets from "../illustrations/sheets.js"
import { Icons } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* The four pages an app shows instead of its content (first built for Squidx
   Ledger): a BlankState with a Hairline figure, the Title Large line, one
   Body Large line and the lg buttons.

     not-found     the drawer   "We couldn't find that page"   Go back + a way home
     load-failed   the server   "This page couldn't load"      Try again
     update-ready  the sheets   "A newer version is ready"     Reload
     start-failed  the engine   "{appName} couldn't start"     Reload

   Each kind has its figure, copy and buttons built in; every piece can be
   replaced. The buttons come from the callbacks: `onBack` and `home` for
   not-found, `onRetry` for load-failed, `onReload` (default: reload the
   page) for the other two. `actions` replaces them all.

   `frame` places it: "page" (the default) fills the space under an app
   shell's page topbar (`topbar`, drawn above it) and is at least the
   screen's height from lg; "screen" is the whole screen on the canvas, for
   a crash outside the shell; "none" just fills its parent. The error kinds
   are an alert; not-found is an ordinary page. */

export type ErrorPageKind = "not-found" | "load-failed" | "update-ready" | "start-failed"

type Preset = {
  figure: HairlineFigure
  label: string
  title: (appName: string) => string
  description: string
}

const PRESETS: Record<ErrorPageKind, Preset> = {
  "not-found": {
    figure: drawer,
    label: "A magnifying glass searching a file drawer for a missing folder",
    title: () => "We couldn’t find that page",
    description: "It may have moved, or the link may be wrong.",
  },
  "load-failed": {
    figure: server,
    label: "A server rack with one blade pulled out and down",
    title: () => "This page couldn’t load",
    description: "Try again. If it keeps happening, reload the app.",
  },
  "update-ready": {
    figure: sheets,
    label: "A new ledger sheet settling onto the stack",
    title: () => "A newer version is ready",
    description: "Reload to pick up the latest update. Nothing you saved is lost.",
  },
  "start-failed": {
    figure: engine,
    label: "An engine that won’t start: one cylinder’s spark plug lead hangs loose",
    title: (appName) => `${appName} couldn’t start`,
    description: "Reload to try again. If it keeps happening, check your connection.",
  },
}

const reloadPage = () => window.location.reload()

export interface ErrorPageProps {
  kind: ErrorPageKind
  /* The app's name, in the start-failed title. Default "The app". */
  appName?: string
  title?: string
  description?: string
  /* Replaces the kind's figure: an Illustration, or anything 320px wide. */
  illustration?: React.ReactNode
  /* Replaces the buttons the callbacks below would draw. */
  actions?: React.ReactNode
  /* not-found: "Go back" (secondary, with the left arrow). */
  onBack?: () => void
  /* not-found: the primary way home, "Go to Overview". `render` draws it as
     the app's own link (<Link to="/" />); `onClick` is the alternative. */
  home?: { label: string; render?: React.ReactElement; onClick?: () => void }
  /* load-failed: "Try again". */
  onRetry?: () => void
  /* update-ready and start-failed: "Reload". Default: reload the page. */
  onReload?: () => void
  /* The page's own topbar, kept above the message ("page" frame only). */
  topbar?: React.ReactNode
  frame?: "page" | "screen" | "none"
  className?: string
}

export function ErrorPage({
  kind,
  appName = "The app",
  title,
  description,
  illustration,
  actions,
  onBack,
  home,
  onRetry,
  onReload = reloadPage,
  topbar,
  frame = "page",
  className,
}: ErrorPageProps): React.ReactElement {
  const preset = PRESETS[kind]

  let buttons: React.ReactNode = actions
  if (buttons === undefined) {
    if (kind === "not-found") {
      buttons = (
        <>
          {onBack ? (
            <Button variant="secondary" size="lg" onClick={onBack}>
              <Icons.arrowLeft aria-hidden />
              Go back
            </Button>
          ) : null}
          {home ? (
            <Button size="lg" render={home.render} onClick={home.onClick}>
              {home.label}
            </Button>
          ) : null}
        </>
      )
    } else if (kind === "load-failed") {
      buttons = onRetry ? (
        <Button size="lg" onClick={onRetry}>
          <Icons.reset aria-hidden />
          Try again
        </Button>
      ) : null
    } else {
      buttons = (
        <Button size="lg" onClick={onReload}>
          <Icons.reset aria-hidden />
          Reload
        </Button>
      )
    }
  }

  const block = (
    <BlankState
      illustration={illustration ?? <Illustration figure={preset.figure} label={preset.label} />}
      title={title ?? preset.title(appName)}
      description={description ?? preset.description}
      actions={buttons}
    />
  )

  return (
    <div
      role={kind === "not-found" ? undefined : "alert"}
      className={cn(
        "flex flex-col",
        frame === "screen" && "min-h-svh bg-canvas",
        frame === "page" && "lg:min-h-svh",
        frame === "none" && "min-h-full",
        className,
      )}
    >
      {frame === "page" ? topbar : null}
      {block}
    </div>
  )
}
