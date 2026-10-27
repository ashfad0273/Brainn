import type * as React from "react"
import { navOverride } from "./icon-overrides"

/* The seven page icons, drawn for the Oct 2026 sidebar (Figma node 30:1537):
   solid glyphs on a 16px grid, filled with currentColor so the row's
   --icon-* token colours them. The one picture per page wherever a nav item
   renders (desktop sidebar, phone menu), and also what
   Icons.overview / accounts / transactions / people / subscriptions /
   settings resolve to, so a page has one picture everywhere. */

export type NavIcon = (props: React.SVGProps<SVGSVGElement> & { size?: number | string }) => React.ReactElement

function navIcon(name: string, paths: readonly string[]): NavIcon {
  const Icon: NavIcon = ({ size, ...props }) => (
    <svg
      viewBox="0 0 16 16"
      width={size ?? 16}
      height={size ?? 16}
      fill="currentColor"
      aria-hidden
      focusable="false"
      {...props}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  )
  ;(Icon as { displayName?: string }).displayName = name
  /* Icon Studio swap, keyed by the page name (OverviewIcon -> "overview"),
     the same key as Icons.overview, so one paste updates both. */
  return navOverride(name.replace(/Icon$/, "").toLowerCase(), Icon)
}

export const OverviewIcon = navIcon("OverviewIcon", [
  "M8.02 2.667c.395 0 .78.132 1.092.375l3.555 2.764c.433.337.686.855.686 1.404v4.8c0 .354-.14.693-.39.943-.25.25-.59.39-.943.39h-8c-.354 0-.693-.14-.943-.39-.25-.25-.39-.59-.39-.943v-4.8c0-.27.062-.537.18-.78.12-.244.292-.457.506-.624l3.556-2.764a1.78 1.78 0 0 1 1.091-.375Zm3.218 6.988a.666.666 0 0 0-.916-.227c-.609.368-1.448.572-2.323.572-.874 0-1.712-.203-2.32-.57a.666.666 0 1 0-.69 1.14c.863.522 1.954.763 3.01.763s2.148-.24 3.012-.762a.667.667 0 0 0 .227-.916Z",
])

export const AccountsIcon = navIcon("AccountsIcon", [
  "M2.75 5A.75.75 0 0 1 2 4.25C2 3.009 3.01 2 4.25 2h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 0-.75.75.75.75 0 0 1-.75.75Z",
  "M12.25 5h-8a.75.75 0 0 1-.75-.75.75.75 0 0 0-1.5 0v6A2.75 2.75 0 0 0 4.75 13h7.5c.965 0 1.75-.785 1.75-1.75v-4.5C14 5.785 13.215 5 12.25 5ZM10 10a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z",
])

export const TransactionsIcon = navIcon("TransactionsIcon", [
  "M10.725 3.297c.971.024 1.883.306 2.853.779.258.125.422.388.422.674v6.5a.75.75 0 0 1-1.078.674c-.817-.398-1.497-.543-2.182-.512-.701.032-1.464.25-2.446.667-1.103.469-2.077.654-3.043.599-.955-.055-1.85-.343-2.791-.737A.75.75 0 0 1 2 11.25v-6.5a.75.75 0 0 1 1.04-.692c.845.353 1.545.514 2.244.506.703-.009 1.462-.19 2.422-.598 1.081-.46 2.048-.693 3.019-.669ZM8 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z",
])

export const PeopleIcon = navIcon("PeopleIcon", [
  "M4.895 5.005a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  "m6.663 6.696.983 2.396a.75.75 0 0 1-.606 1.03l-.612.072-.215 3.343a.5.5 0 0 1-.5.468H4.077a.5.5 0 0 1-.5-.468l-.215-3.343-.67-.08a.75.75 0 0 1-.592-.978c.325-.812.759-1.82 1.025-2.445a.85.85 0 0 1 .536-.482 4.3 4.3 0 0 1 2.467 0c.242.074.438.253.535.487Z",
  "M11.202 5.005a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  "m12.794 6.69 1.174 4.223a.75.75 0 0 1-.634.945l-.724.087-.193 1.62a.5.5 0 0 1-.496.44h-1.437a.5.5 0 0 1-.496-.44l-.193-1.62-.67-.08a.75.75 0 0 1-.662-1c.349-1.279.861-3.345 1.14-4.226a.65.65 0 0 1 .427-.42l.04-.014a3.6 3.6 0 0 1 2.265 0 .65.65 0 0 1 .46.484Z",
])

export const SubscriptionsIcon = navIcon("SubscriptionsIcon", [
  "M5.02 3.755v-1a.75.75 0 0 1 1.5 0v1a.75.75 0 0 1-1.5 0Zm4.5 0v-1a.75.75 0 0 1 1.5 0v1a.75.75 0 0 1-1.5 0Z",
  "M10.77 3.005a2.75 2.75 0 0 1 2.75 2.75v.75a.5.5 0 0 1-.5.5h-9v4.25c0 .69.56 1.25 1.25 1.25h2.502a.75.75 0 0 1 0 1.5H5.27a2.75 2.75 0 0 1-2.75-2.75v-5.5a2.75 2.75 0 0 1 2.75-2.75h5.5Z",
  "m13.643 10.71-1.389-.466-.463-1.4c-.15-.452-.893-.452-1.043 0l-.463 1.4-1.389.466a.55.55 0 0 0 0 1.05l1.389.467.463 1.4a.55.55 0 0 0 1.044 0l.463-1.4 1.389-.467a.55.55 0 0 0 0-1.05Z",
])

/* Projects: Remix's briefcase-4-fill, scaled from its 24px grid to 16. */
export const ProjectsIcon = navIcon("ProjectsIcon", [
  "M6 8.667V10.667H10V8.667H14.667V13.333C14.667 13.702 14.368 14 14 14H2C1.632 14 1.333 13.702 1.333 13.333V8.667H6ZM7.333 7.333H8.667V9.333H7.333V7.333ZM4.667 3.333V1.333C4.667 0.965 4.965 0.667 5.333 0.667H10.667C11.035 0.667 11.333 0.965 11.333 1.333V3.333H14C14.368 3.333 14.667 3.632 14.667 4V7.333H10V6H6V7.333H1.333V4C1.333 3.632 1.632 3.333 2 3.333H4.667ZM6 2V3.333H10V2H6Z",
])

export const SettingsIcon = navIcon("SettingsIcon", [
  "M6.842 2.321a2.35 2.35 0 0 1 2.356 0l3.199 1.853a2.25 2.25 0 0 1 1.122 1.947v3.77a2.25 2.25 0 0 1-1.122 1.947l-3.2 1.852a2.35 2.35 0 0 1-2.355 0l-3.199-1.852a2.25 2.25 0 0 1-1.123-1.947v-3.77c0-.803.428-1.545 1.123-1.947l3.199-1.853ZM8.02 6.006a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
])
