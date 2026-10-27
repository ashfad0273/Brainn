"use client";

import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area";
import type React from "react";
import { cn } from "../../lib/utils";

export function ScrollArea({
  className,
  children,
  scrollFade = true,
  scrollbarGutter = false,
  fill = false,
  clampContentMinWidth = true,
  scrollbarOnScroll = false,
  ...props
}: ScrollAreaPrimitive.Root.Props & {
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
  fill?: boolean;
  clampContentMinWidth?: boolean;
  /* The bar shows only while scrolling, not on hover too. */
  scrollbarOnScroll?: boolean;
}): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Root
      className={cn(
        /* The keyboard focus ring sits on the root: the viewport may carry
           the fade mask, which would clip a ring drawn on it. */
        "size-full min-h-0 rounded-[inherit] has-[>[data-slot=scroll-area-viewport]:focus-visible]:ring-2 has-[>[data-slot=scroll-area-viewport]:focus-visible]:ring-ring has-[>[data-slot=scroll-area-viewport]:focus-visible]:ring-offset-1 has-[>[data-slot=scroll-area-viewport]:focus-visible]:ring-offset-background",
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        className={cn(
          "h-full rounded-[inherit] outline-none data-has-overflow-y:overscroll-y-contain data-has-overflow-x:overscroll-x-contain",
          /* scrollFade (on by default): the edge with more content past it
             fades into the surface, sized by how far the content runs on
             (scroll-area-fade in ume.css). A hard edge reads as a list
             that ends. */
          scrollFade && "scroll-area-fade",
          scrollbarGutter &&
            "data-has-overflow-y:pe-2.5 data-has-overflow-x:pb-2.5",
        )}
        data-slot="scroll-area-viewport"
      >
        <ScrollAreaPrimitive.Content
          className={cn(fill && "size-full")}
          data-slot="scroll-area-content"
          style={clampContentMinWidth ? { minWidth: 0 } : undefined}
        >
          {children}
        </ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="vertical" onScrollOnly={scrollbarOnScroll} />
      <ScrollBar orientation="horizontal" onScrollOnly={scrollbarOnScroll} />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
}

export function ScrollBar({
  className,
  orientation = "vertical",
  onScrollOnly = false,
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props & { onScrollOnly?: boolean }): React.ReactElement {
  return (
    <ScrollAreaPrimitive.Scrollbar
      className={cn(
        // The 300ms delay is how long the bar lingers after scrolling stops
        // before it fades, not a motion: allow-slow-duration
        "m-1 flex opacity-0 transition-[opacity] delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-scrolling:opacity-100 data-scrolling:delay-0 data-scrolling:duration-100",
        !onScrollOnly && "data-hovering:opacity-100 data-hovering:delay-0 data-hovering:duration-100",
        className,
      )}
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        className="relative flex-1 rounded-full bg-foreground/20"
        data-slot="scroll-area-thumb"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollAreaPrimitive };
