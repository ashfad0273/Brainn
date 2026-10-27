"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { motion, type HTMLMotionProps } from "motion/react";
import * as React from "react";
import { SPRING } from "../../lib/ease";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";

export function Switch({
  className,
  onPointerDown,
  onPointerUp,
  onPointerLeave,
  ...props
}: SwitchPrimitive.Root.Props): React.ReactElement {
  const reduce = useAppReducedMotion();
  const [pressed, setPressed] = React.useState(false);

  return (
    <SwitchPrimitive.Root
      {...props}
      className={cn(
        /* 36×20 with a 16px thumb and no border in either state (Settings,
           approved Oct 2026): filled track grey when off, primary when on.
           The white thumb carries a small shadow so it reads on the grey. */
        "group peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full p-0.5 outline-none transition-[background-color] duration-fast",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "data-disabled:cursor-not-allowed data-disabled:opacity-64",
        "data-checked:justify-end data-checked:bg-primary",
        "data-unchecked:justify-start data-unchecked:bg-track",
        className,
      )}
      data-slot="switch"
      onPointerDown={(e) => {
        setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        render={(thumbProps, state) => {
          const squish = !reduce && !state.disabled && pressed;
          return (
            <motion.span
              {...(thumbProps as HTMLMotionProps<"span">)}
              layout={!reduce}
              initial={false}
              animate={{ scale: squish ? 0.96 : 1 }}
              transition={reduce ? { duration: 0 } : SPRING}
              className={cn(
                "pointer-events-none block size-4 rounded-full bg-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.18)]",
                thumbProps.className,
              )}
            />
          );
        }}
      />
    </SwitchPrimitive.Root>
  );
}

export { SwitchPrimitive };
