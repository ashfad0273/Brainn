import * as React from "react"
import { cn } from "../../lib/utils"

/* The round Squidx logo from the approved sidebar (Figma node 30:1537): a
   32px neutral-11 circle with a 1px inset neutral-92 ring and a four-point
   star fading from white at the top to #454545 at the bottom. The star's
   fade is one of the two gradients the designer approved, so this file is on
   check-conventions' GRADIENT_ALLOWLIST. Decorative: the account name sits
   next to it wherever it appears.

   In dark the ring steps down to neutral-22: a near-white hairline on a dark
   sidebar read as an outline rather than the quiet edge it is in light. */

const STAR =
  "M16 8s1.517 3.283 3.117 4.883C20.717 14.483 24 16 24 16s-3.283 1.517-4.883 3.117C17.517 20.717 16 24 16 24s-1.517-3.283-3.117-4.883C11.283 17.517 8 16 8 16s3.283-1.517 4.883-3.117C14.483 11.283 16 8 16 8Z"

export function SquidxLogo({ className }: { className?: string }) {
  /* useId so two logos on a page (mobile header + sidebar) never share a
     fill id; colons are not valid in a url(#…) reference. */
  const id = `squidx-star-${React.useId().replace(/:/g, "")}`
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-(--neutral-11) shadow-[inset_0_0_0_1px_var(--neutral-92)] dark:shadow-[inset_0_0_0_1px_var(--neutral-22)]",
        className,
      )}
    >
      <svg viewBox="8 8 16 16" className="size-1/2" focusable="false">
        <defs>
          <linearGradient id={id} x1="16" y1="8" x2="16" y2="24" gradientUnits="userSpaceOnUse">
            <stop style={{ stopColor: "var(--logo-star-top)" }} />
            <stop offset="1" style={{ stopColor: "var(--logo-star-bottom)" }} />
          </linearGradient>
        </defs>
        <path fill={`url(#${id})`} d={STAR} />
      </svg>
    </span>
  )
}
