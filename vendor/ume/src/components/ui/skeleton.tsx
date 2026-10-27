"use client";

import type React from "react";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";

/* A flat muted block with a slow opacity pulse — no sweep, no gradients
   anywhere. The keyframes live in index.css (`animate-skeleton`) rather than
   in a <style> tag per instance — a loading table used to inject the same rule
   once per placeholder cell. App reduced motion drops the pulse entirely (the
   media query alone misses the Settings toggle), leaving the still block. */
export function Skeleton({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  const reduce = useAppReducedMotion();

  return (
    <div
      className={cn(
        "rounded-sm bg-muted",
        !reduce && "animate-skeleton",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
