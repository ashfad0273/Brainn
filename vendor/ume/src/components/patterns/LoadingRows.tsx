import { Skeleton } from "../ui/skeleton"
import { cn } from "../../lib/utils"
import { panel } from "./surface"

/* Placeholders for the first fetch. Routes that render straight from
   AppDataProvider otherwise paint their "nothing here yet" state while the
   request is still in flight, which is both a layout shift and a lie — gate on
   `ready` and show these instead.

   Sized to the real rows/cards so data landing doesn't move anything, and
   marked aria-busy so assistive tech announces the wait rather than an empty
   table. */

export function LoadingRows({
  rows = 6,
  className,
}: {
  rows?: number
  className?: string
}): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className={cn("divide-y divide-border", className)}
      role="status"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div className="flex min-h-12 items-center gap-3 px-4 py-3" key={i}>
          <Skeleton className="h-3.5 w-20 shrink-0 rounded-full" />
          <Skeleton className="h-3.5 min-w-0 flex-1 rounded-full" />
          <Skeleton className="h-3.5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function LoadingPanels({
  count = 2,
  className,
}: {
  count?: number
  className?: string
}): React.ReactElement {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className={cn("grid grid-cols-1 gap-4 lg:grid-cols-2", className)}
      role="status"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          className={panel}
          key={i}
        >
          <Skeleton className="h-3.5 w-28 rounded-full" />
          <Skeleton className="mt-4 h-8 w-40 rounded-lg" />
          <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}
