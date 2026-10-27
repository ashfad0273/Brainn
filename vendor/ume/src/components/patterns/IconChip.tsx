import * as React from "react"
import { HUE_CLASSES, type Hue, initials, nameHue } from "../../lib/hue"
import type { Icon } from "../../lib/icons"
import { cn } from "../../lib/utils"

/* The coloured square that leads stat cards, list rows, section headings and
   empty states (standard.md §2): the icon in the hue's solid on its soft
   tint. `hue="brand"` is solid --primary for the one hero figure;
   `hue="neutral"` (or none) is a quiet grey chip for system rows such as
   transfers.

   Sizes: sm 28px (16px icon), md 36px (20px icon, the default), lg 48px
   (24px icon, empty states). Decorative: the adjacent text names it. */

export type ChipHue = Hue | "brand" | "neutral"
export type ChipSize = "sm" | "md" | "lg"

const SIZE: Record<ChipSize, string> = {
  sm: "size-7 rounded-lg [&_svg]:size-4",
  md: "size-9 rounded-xl [&_svg]:size-5",
  lg: "size-12 rounded-2xl [&_svg]:size-6",
}

function chipColor(hue: ChipHue | null | undefined): string {
  if (!hue || hue === "neutral") return "bg-muted text-muted-foreground"
  if (hue === "brand") return "bg-primary text-primary-foreground shadow-xs"
  const h = HUE_CLASSES[hue]
  return `${h.soft} ${h.solid}`
}

/* A component reference (function, or a memo/forwardRef object) rather than
   something already renderable. */
function isComponent(x: unknown): x is Icon {
  if (typeof x === "function") return true
  return typeof x === "object" && x !== null && !React.isValidElement(x) && "$$typeof" in x
}

export function IconChip({
  icon,
  hue,
  size = "md",
  className,
}: {
  /* An Icons.* component, or an element when it needs its own props. */
  icon: Icon | React.ReactNode
  hue?: ChipHue | null
  size?: ChipSize
  className?: string
}) {
  const node = isComponent(icon) ? React.createElement(icon) : icon
  return (
    <span
      aria-hidden
      data-slot="icon-chip"
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        SIZE[size],
        chipColor(hue),
        className,
      )}
    >
      {node}
    </span>
  )
}

const AVATAR_SIZE: Record<ChipSize, string> = {
  sm: "size-7 text-label-mono",
  md: "size-9 text-label-mono",
  lg: "size-12 text-sm",
}

/* Initials on a hue picked from the name (nameHue), for people and clients:
   the same name is the same colour everywhere. Drawn like an image, so it
   carries the 10% inset image-outline: a pale tint on a white card would
   otherwise have no edge. Circle for people, rounded
   square (`shape="square"`) for companies and clients. */
export function InitialsAvatar({
  name,
  hue,
  size = "md",
  shape = "circle",
  className,
}: {
  name: string | null | undefined
  hue?: Hue
  size?: ChipSize
  shape?: "circle" | "square"
  className?: string
}) {
  const h = HUE_CLASSES[hue ?? nameHue(name)]
  return (
    <span
      aria-hidden
      data-slot="initials-avatar"
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center font-medium image-outline",
        AVATAR_SIZE[size],
        shape === "circle" ? "rounded-full" : size === "lg" ? "rounded-2xl" : "rounded-xl",
        h.soft,
        h.ink,
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
