"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { Icons, type Icon } from "../../lib/icons";
import {
  AnimatePresence,
  motion,
  type Variants,
} from "motion/react";
import type React from "react";
import type { AnimatedBadgeStatus } from "../motion/animated-badge";
import { DURATION, EASE_OUT, SPRING } from "../../lib/ease";
import { useAppReducedMotion } from "../../lib/motion";
import { HUE_CLASSES, type Hue } from "../../lib/hue";
import { cn } from "../../lib/utils";

export type BadgeStatus = AnimatedBadgeStatus;

/* Vibrant badges: a soft tinted pill with ink text and a hairline ring in
   the same hue, plus an optional status dot (`dot`). One hue per meaning:
   primary = default/info, green = success, amber = warning, rose =
   error/destructive, neutral = secondary/outline. `hue` paints the badge in
   any hue of the family instead (a category, a client). */
export const badgeVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border outline-none transition-[color,background-color,border-color] duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [button&,a&]:cursor-pointer [button&,a&]:pointer-coarse:after:absolute [button&,a&]:pointer-coarse:after:size-full [button&,a&]:pointer-coarse:after:min-h-11 [button&,a&]:pointer-coarse:after:min-w-11",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-6 min-w-6 px-2.5 text-label-mono",
        lg: "h-7 min-w-7 px-3 text-label-mono",
        sm: "h-5 min-w-5 px-2 text-label-mono [&_svg:not([class*='size-'])]:size-3",
      },
      variant: {
        default:
          "border-blue-ring bg-primary-soft text-primary-ink [button&,a&]:hover:bg-blue-ring",
        destructive:
          "border-rose-ring bg-neg-soft text-neg-ink [button&,a&]:hover:bg-rose-ring",
        error: "border-rose-ring bg-neg-soft text-neg-ink",
        info: "border-blue-ring bg-primary-soft text-primary-ink",
        outline:
          "border-border bg-card text-foreground [button&,a&]:hover:bg-muted",
        secondary:
          "border-border bg-muted text-foreground [button&,a&]:hover:bg-border",
        success: "border-green-ring bg-pos-soft text-pos-ink",
        warning: "border-amber-ring bg-warn-soft text-warn-ink",
      },
    },
  },
);

/* Dot colour per variant: the solid hue, so the dot reads as the signal. */
const DOT: Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, string> = {
  default: "bg-primary",
  destructive: "bg-rose",
  error: "bg-rose",
  info: "bg-blue",
  outline: "bg-muted-foreground",
  secondary: "bg-muted-foreground",
  success: "bg-green",
  warning: "bg-amber",
};

const STATUS_ICONS: Record<BadgeStatus, Icon> = {
  neutral: Icons.neutral,
  info: Icons.info,
  success: Icons.check,
  warning: Icons.warning,
  danger: Icons.close,
  loading: Icons.loading,
};

const ICON_ROLL_VARIANTS: Variants = {
  initial: {
    opacity: 0.72,
    y: "80%",
    scale: 0.92,
    rotate: -8,
    filter: "blur(6px)",
  },
  animate: {
    opacity: 1,
    y: "0%",
    scale: 1,
    rotate: 0,
    filter: "blur(0px)",
    /* Badge swap: the standard spring for travel, `base` for the rest, and
       the blur clears with the fade (it used to linger for 420ms). */
    transition: {
      y: SPRING,
      scale: SPRING,
      rotate: { duration: DURATION.base, ease: EASE_OUT },
      opacity: { duration: DURATION.base, ease: EASE_OUT },
      filter: { duration: 0.2, ease: EASE_OUT },
    },
  },
  exit: {
    opacity: 0.5,
    y: "-80%",
    scale: 0.96,
    rotate: 8,
    filter: "blur(6px)",
    transition: { duration: DURATION.fast, ease: EASE_OUT },
  },
};

function BadgeStatusIcon({
  status,
  size,
}: {
  status: BadgeStatus;
  size?: VariantProps<typeof badgeVariants>["size"];
}): React.ReactElement {
  const reduce = useAppReducedMotion();
  const Icon = STATUS_ICONS[status];
  const iconClass =
    size === "sm" ? "size-3" : size === "lg" ? "size-3.5" : "size-3";

  return (
    <span className="relative inline-flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          aria-hidden
          data-badge-icon
          variants={ICON_ROLL_VARIANTS}
          initial={reduce ? false : "initial"}
          animate={reduce ? { opacity: 1 } : "animate"}
          exit={reduce ? undefined : "exit"}
          className="inline-flex will-change-transform"
        >
          {status === "loading" && !reduce ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="inline-flex"
            >
              <Icon className={iconClass} />
            </motion.span>
          ) : (
            <Icon className={iconClass} />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export interface BadgeProps extends useRender.ComponentProps<"span"> {
  variant?: VariantProps<typeof badgeVariants>["variant"];
  size?: VariantProps<typeof badgeVariants>["size"];
  /** Shows beUI's animated status icon ahead of the label. */
  status?: BadgeStatus;
  /** A 6px status dot ahead of the label, in the variant's (or hue's) solid. */
  dot?: boolean;
  /** Paint the badge in one hue of the family instead of a variant. */
  hue?: Hue;
}

export function Badge({
  className,
  variant,
  size,
  status,
  dot = false,
  hue,
  render,
  children,
  ...props
}: BadgeProps): React.ReactElement {
  const h = hue ? HUE_CLASSES[hue] : null;
  const defaultProps = {
    children: (
      <>
        {status != null ? <BadgeStatusIcon status={status} size={size} /> : null}
        {dot ? (
          <span
            aria-hidden
            data-slot="badge-dot"
            className={cn("size-1.5 shrink-0 rounded-full", h ? h.fill : DOT[variant ?? "default"])}
          />
        ) : null}
        {children}
      </>
    ),
    className: cn(
      badgeVariants({ size, variant }),
      h && [h.soft, h.ink, h.ring],
      className,
    ),
    "data-slot": "badge",
  };

  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(defaultProps, props),
    render,
  });
}
