import * as React from "react"
import { motion } from "motion/react"
import { DURATION, EASE_OUT } from "../../lib/ease"
import { useAppReducedMotion } from "../../lib/motion"
import { cn } from "../../lib/utils"
import { byLayout, DEFAULT_SHELL_LABELS, ShellProvider } from "./context"
import { Sidebar } from "./Sidebar"
import type { ShellConfig } from "./types"

/* The app shell: the desktop sidebar (Sidebar: logo, account menu, pages,
   sync pill) and a content column on the canvas where every page draws its
   own PageTopbar. Below lg the sidebar is hidden and navigation moves to the
   menu in each page's top bar (PhoneMenu).

   Ume holds no app data and no router: the app passes the pages, the
   current path, a link renderer, who is signed in and the account
   callbacks, and the shell hands them to its parts through context. */

export { ShellProvider, useShell, ShellLink, DEFAULT_SHELL_LABELS } from "./context"
export type * from "./types"

/* One shared page width for every page, so a top bar's title and actions
   line up with the page under them. rem, not px: the root font size grows
   on very large screens. */
const CONTENT = "mx-auto w-full max-w-[120rem]"

/* Page enter: opacity only, the `base` duration, the one ease-out. No exit,
   so the next page never waits on the last one. */
const PAGE_ENTER = { duration: DURATION.base, ease: EASE_OUT } as const

export type AppShellProps = ShellConfig & {
  /* The page. */
  children: React.ReactNode
  /* Replays the page's enter fade when it changes, e.g. the pathname (not
     the query, so a tab or filter change doesn't replay it). */
  pageKey?: string
  /* Wraps the page outside its width and fade, e.g. an error boundary. */
  pageBoundary?: React.ComponentType<{ children: React.ReactNode }>
  /* Fill the parent instead of the viewport, and keep the phone menu inside
     it: for a preview, or an app inside a frame. */
  contained?: boolean
  /* The id of the main landmark the skip link jumps to. */
  mainId?: string
  /* Adds a polite aria-live region with this id after the page, for the
     app's announcements. */
  liveRegionId?: string
  className?: string
}

export function AppShell({
  children,
  pageKey,
  pageBoundary: Boundary,
  contained = false,
  mainId = "main",
  liveRegionId,
  className,
  ...config
}: AppShellProps): React.ReactElement {
  const reduce = useAppReducedMotion()
  const [root, setRoot] = React.useState<HTMLDivElement | null>(null)
  const layout = config.layout ?? "responsive"
  const skip = config.labels?.skipToContent ?? DEFAULT_SHELL_LABELS.skipToContent

  /* Keyed on pageKey so only a real page change replays it. initial={false}
     under reduced motion. */
  const page = (
    <motion.div
      key={pageKey}
      className={CONTENT}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduce ? { duration: 0 } : PAGE_ENTER}
    >
      {children}
    </motion.div>
  )

  return (
    <ShellProvider {...config} contained={contained} portalContainer={contained ? root : null}>
      <div
        ref={contained ? setRoot : undefined}
        className={cn(
          "grid grid-cols-1 bg-background text-foreground",
          byLayout(layout, {
            responsive: "lg:grid-cols-[auto_1fr]",
            desktop: "grid-cols-[auto_1fr]",
            phone: "",
          }),
          /* Contained: the frame is the containing block for the phone
             menu's fixed layers, and the page column scrolls on its own. */
          contained ? "relative h-full min-h-0 grid-rows-[minmax(0,1fr)] overflow-hidden [contain:layout]" : "min-h-svh",
          className,
        )}
      >
        <a
          href={`#${mainId}`}
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:text-sm"
        >
          {skip}
        </a>
        <Sidebar />

        <div className={cn("flex min-w-0 flex-col", contained && "min-h-0 overflow-y-auto")}>
          <main id={mainId} className="min-w-0 flex-1 bg-canvas pb-[env(safe-area-inset-bottom)]">
            {Boundary ? <Boundary>{page}</Boundary> : page}
          </main>
          {liveRegionId ? <div id={liveRegionId} aria-live="polite" className="sr-only" /> : null}
        </div>
      </div>
    </ShellProvider>
  )
}
