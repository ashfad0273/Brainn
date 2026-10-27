import { useLayoutEffect, useRef } from "react"
import { cn } from "../../lib/utils"
import HL, { type HairlineFigure } from "./hairline-kernel.js"

/* One Hairline figure: an isometric line drawing that answers the pointer.
   The figure draws into an svg this box hands it, at the middle of its range,
   and tears down on unmount. The box keeps the figure's 5:4 shape, so nothing
   shifts while it draws. Colour touches are classes on the drawing, mapped to
   the hue family in index.css. */
export function Illustration({
  figure,
  label,
  className,
}: {
  figure: HairlineFigure
  /* The accessible name; defaults to the figure's own description. */
  label?: string
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const stage = ref.current
    if (!stage) return
    HL.inject(document)
    stage.setAttribute("data-hairline", figure.name)
    const svg = HL.mk("svg", { viewBox: "0 0 400 320", "aria-hidden": "true" }, stage) as SVGSVGElement
    const read = { textContent: "rest" as string | null }
    const handle = figure.mount({ stage, svg, read }, figure.range[1])
    return () => {
      handle.destroy()
      svg.remove()
    }
  }, [figure])

  return <div ref={ref} role="img" aria-label={label ?? figure.means} className={cn("w-full", className)} />
}
