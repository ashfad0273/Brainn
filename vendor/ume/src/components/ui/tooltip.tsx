"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type React from "react";
import { TOOLTIP_DELAY_MS } from "../../lib/ease";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";

/* Tooltips (standard.md §6, hover restraint). Hover is the most frequent
   interaction, so a tooltip must not pop up while the pointer is only
   passing through: the first one waits TOOLTIP_DELAY_MS (500ms). Once one
   is open its neighbours open at once (Base UI marks them data-instant and
   they skip the fade), and every tooltip closes instantly.

   Wrap a toolbar, or the whole app, in one TooltipProvider so the tooltips
   in it share that delay. A tooltip without a provider still waits, it just
   can't hand the open state to its neighbour. The label is short, one line,
   sentence case, and never the only name of a control: an icon button
   keeps its aria-label. */

export function TooltipProvider({
  delay = TOOLTIP_DELAY_MS,
  closeDelay = 0,
  ...props
}: TooltipPrimitive.Provider.Props): React.ReactElement {
  return <TooltipPrimitive.Provider closeDelay={closeDelay} delay={delay} {...props} />;
}

export const Tooltip: typeof TooltipPrimitive.Root = TooltipPrimitive.Root;

export function TooltipTrigger({
  className,
  children,
  ...props
}: TooltipPrimitive.Trigger.Props): React.ReactElement {
  return (
    <TooltipPrimitive.Trigger className={className} data-slot="tooltip-trigger" {...props}>
      {children}
    </TooltipPrimitive.Trigger>
  );
}

export function TooltipPopup({
  children,
  className,
  side = "top",
  align = "center",
  sideOffset = 6,
  portalProps,
  ...props
}: TooltipPrimitive.Popup.Props & {
  side?: TooltipPrimitive.Positioner.Props["side"];
  align?: TooltipPrimitive.Positioner.Props["align"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  portalProps?: TooltipPrimitive.Portal.Props;
}): React.ReactElement {
  const reduce = useAppReducedMotion();

  return (
    <TooltipPrimitive.Portal {...portalProps}>
      <TooltipPrimitive.Positioner
        align={align}
        className="z-50"
        data-slot="tooltip-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <TooltipPrimitive.Popup
          className={cn(
            "w-fit max-w-64 origin-(--transform-origin) rounded-lg glass not-dark:bg-clip-padding px-2 py-1 text-balance text-popover-foreground text-xs outline-none data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:duration-0 data-instant:duration-0",
            reduce
              ? "transition-opacity duration-0"
              : "transition-[scale,opacity] duration-fast ease-out data-starting-style:scale-[0.96]",
            className,
          )}
          data-slot="tooltip-popup"
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}
