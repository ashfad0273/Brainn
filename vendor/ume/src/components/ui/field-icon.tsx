import * as React from "react";
import type { Icon } from "../../lib/icons";
import { cn } from "../../lib/utils";

/* The leading field icon shared by Input, Textarea, SelectTrigger and
   ComboboxInput (standard.md §3): a muted 18px Remix line icon at the
   start of the control, so a form scans by meaning before the labels are
   read — `Icons.amount`, `Icons.date`, `Icons.category`, `Icons.client`,
   `Icons.person`, `Icons.account`, `Icons.notes`, `Icons.search`,
   `Icons.email`, `Icons.password`.

   Pass the icon component (`leadingIcon={Icons.date}`) or an element when
   it needs its own props. Decorative: the field's label names it. */
export type FieldIcon = Icon | React.ReactElement;

export function FieldIconSlot({
  icon,
  className,
}: {
  icon: FieldIcon | undefined;
  className?: string;
}): React.ReactElement | null {
  if (!icon) return null;
  const node = React.isValidElement(icon)
    ? icon
    : React.createElement(icon as Icon);
  return (
    <span
      aria-hidden
      data-slot="field-icon"
      className={cn(
        "pointer-events-none flex shrink-0 items-center ps-3 text-muted-foreground [&_svg:not([class*='size-'])]:size-4.5",
        className,
      )}
    >
      {node}
    </span>
  );
}
