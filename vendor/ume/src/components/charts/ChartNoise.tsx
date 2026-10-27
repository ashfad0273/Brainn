/* The Figma noise effect on chart fills (Noise, Monotone, density 1), drawn
   as an SVG filter: fractal noise thresholded to a 1-bit grain, inked with a
   token colour and laid over the shape it filters. Put it in the chart's
   <defs> and reference it with filter={`url(#${id})`}.

   `frequency` follows the Figma noise size: size 0.5 (the trend area) reads
   as 2, size 0.9 (the donut) as 1.1. The chart must draw at real pixel size
   (no viewBox scaling) or the grain stretches. */

export function ChartNoise({
  id,
  ink,
  frequency = 2,
  blend = "normal",
}: {
  id: string
  ink: string
  frequency?: number
  /* The Figma layer blend of the grain: "overlay" for the donut. */
  blend?: "normal" | "overlay"
}) {
  return (
    <filter
      id={id}
      x="0"
      y="0"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
      colorInterpolationFilters="sRGB"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency={`${frequency} ${frequency}`}
        numOctaves={3}
        seed={7146}
        stitchTiles="stitch"
        result="n"
      />
      <feColorMatrix in="n" type="luminanceToAlpha" result="a" />
      <feComponentTransfer in="a" result="m">
        <feFuncA type="discrete" tableValues="1 0" />
      </feComponentTransfer>
      <feComposite in="m" in2="SourceGraphic" operator="in" result="clip" />
      <feFlood style={{ floodColor: ink }} result="ink" />
      <feComposite in="ink" in2="clip" operator="in" result="dots" />
      {blend === "overlay" ? (
        <feBlend in="dots" in2="SourceGraphic" mode="overlay" />
      ) : (
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="dots" />
        </feMerge>
      )}
    </filter>
  )
}
