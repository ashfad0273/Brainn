import type { RemixiconComponentType } from "@remixicon/react"

/* Icons drawn in the designer's Figma file (Overview, frame 67:1205), copied
   path for path so the app matches the design. All sit on the same grid as
   the nav icons: a 16px box with a 12px glyph, filled with currentColor so the
   --icon-* tokens colour them. The 12px Figma glyphs (clock, sort, chevron)
   get a 2px inset (viewBox -2 -2 16 16) to land on that grid.

   They take the same props as the Remix icons (size, color, className), so
   src/lib/icons.ts can list them next to the Remix set. */

function figmaIcon(name: string, viewBox: string, paths: readonly string[]): RemixiconComponentType {
  const Icon: RemixiconComponentType = ({ size, color = "currentColor", ...props }) => (
    <svg
      viewBox={viewBox}
      width={size ?? 16}
      height={size ?? 16}
      fill={color}
      aria-hidden
      focusable="false"
      {...props}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
  Icon.displayName = name
  return Icon
}

const GRID = "0 0 16 16"
const INSET = "-2 -2 16 16"

export const AddCircleIcon = figmaIcon("AddCircleIcon", GRID, [
  "M8 2c3.314 0 6 2.686 6 6s-2.686 6-6 6-6-2.686-6-6 2.686-6 6-6Zm0 3a.75.75 0 0 0-.75.75v1.5h-1.5a.75.75 0 0 0 0 1.5h1.5v1.5a.75.75 0 0 0 1.5 0v-1.5h1.5a.75.75 0 0 0 0-1.5h-1.5v-1.5A.75.75 0 0 0 8 5Z",
])

export const CalendarIcon = figmaIcon("CalendarIcon", GRID, [
  "M6 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  "M11 3.525V2.75a.75.75 0 0 0-1.5 0v.75h-3v-.75a.75.75 0 0 0-1.5 0v.775A2.74 2.74 0 0 0 2.5 6.25v5A2.75 2.75 0 0 0 5.25 14h5.5a2.75 2.75 0 0 0 2.75-2.75v-5A2.74 2.74 0 0 0 11 3.525ZM12 11.25c0 .689-.561 1.25-1.25 1.25h-5.5c-.689 0-1.25-.561-1.25-1.25V7h8v4.25Z",
])

export const FilterIcon = figmaIcon("FilterIcon", GRID, [
  "M13.25 5.5H2.75a.75.75 0 0 1 0-1.5h10.5a.75.75 0 0 1 0 1.5Z",
  "M11.25 9h-6.5a.75.75 0 0 1 0-1.5h6.5a.75.75 0 0 1 0 1.5Z",
  "M9.25 12.5h-2.5a.75.75 0 0 1 0-1.5h2.5a.75.75 0 0 1 0 1.5Z",
])

export const ClockIcon = figmaIcon("ClockIcon", INSET, [
  "M6 0C2.691 0 0 2.691 0 6s2.691 6 6 6 6-2.691 6-6-2.691-6-6-6Zm2.564 8.244A.75.75 0 0 1 7.999 8.5a.746.746 0 0 1-.493-.186l-2-1.75A.75.75 0 0 1 5.25 6V3.25a.75.75 0 0 1 1.5 0v2.41l1.744 1.526a.75.75 0 0 1 .07 1.058Z",
])

export const SortIcon = figmaIcon("SortIcon", INSET, [
  "M6 11.75a.748.748 0 0 1-.53-.22l-2.75-2.75a.75.75 0 0 1 1.061-1.061L6.001 9.939l2.22-2.22a.75.75 0 0 1 1.061 1.061l-2.75 2.75a.748.748 0 0 1-.53.22H6Z",
  "M8.75 4.5a.748.748 0 0 1-.53-.22L6 2.06 3.78 4.28a.75.75 0 0 1-1.061-1.061L5.47.47a.75.75 0 0 1 1.061 0l2.75 2.75a.75.75 0 0 1-.53 1.281Z",
])

export const ChevronRightIcon = figmaIcon("ChevronRightIcon", INSET, [
  "M4.25 11a.748.748 0 0 1-.53-1.281L7.44 5.999 3.72 2.279a.75.75 0 0 1 1.061-1.061l4.25 4.25a.75.75 0 0 1 0 1.061l-4.25 4.25a.748.748 0 0 1-.53.22Z",
])
