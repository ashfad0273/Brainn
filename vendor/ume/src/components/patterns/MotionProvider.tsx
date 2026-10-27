import * as React from "react"
import { MotionConfig } from "motion/react"
import { useAppReducedMotion } from "../../lib/motion"

/* beUI components animate with Motion springs, which only read the OS
   prefers-reduced-motion setting. MotionConfig extends that to the app's own
   Settings toggle, so one switch calms every animated component. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useAppReducedMotion()
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>{children}</MotionConfig>
  )
}
