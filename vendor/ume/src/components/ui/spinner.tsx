"use client";

import { Icons } from "../../lib/icons";
import type React from "react";
import { Loader } from "../motion/loader";
import { cn } from "../../lib/utils";

function resolveLoaderSize(
  size: React.ComponentProps<typeof Icons.loading>["size"],
  className: string | undefined,
): number {
  if (typeof size === "number") return size;
  if (typeof size === "string") {
    const n = Number.parseFloat(size);
    if (!Number.isNaN(n)) return n;
  }
  /* Tailwind size-N → N × 4px on the default spacing scale (size-6 → 24). */
  const m = className?.match(/(?:^|\s)size-(\d+(?:\.\d+)?)(?:\s|$)/);
  if (m) return Number(m[1]) * 4;
  return 16;
}

export function Spinner({
  className,
  size,
  "aria-label": ariaLabel = "Loading",
  ...props
}: React.ComponentProps<typeof Icons.loading>): React.ReactElement {
  const label = typeof ariaLabel === "string" ? ariaLabel : "Loading";
  const loaderSize = resolveLoaderSize(size, className);

  /* Forward data-* (button sets data-slot=button-loading-indicator) so parent
     colour selectors keep matching. Lucide-only SVG props are dropped.
     aria-hidden makes the spinner decorative: beside text that already says
     "Loading entries", a screen reader shouldn't hear "Loading" too. */
  const forwarded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("data-") || key === "id") {
      forwarded[key] = value;
    }
  }
  const hidden = props["aria-hidden"] === true || props["aria-hidden"] === "true";

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      aria-hidden={hidden || undefined}
      {...forwarded}
    >
      <Loader
        variant="spinner"
        size={loaderSize}
        label={label}
        decorative={hidden}
        className="text-current"
      />
    </span>
  );
}
