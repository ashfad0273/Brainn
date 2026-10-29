"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { motion } from "motion/react";
import * as React from "react";
import {
  StatefulButton as MotionStatefulButton,
  type ButtonState,
  type StatefulButtonProps as MotionStatefulButtonProps,
} from "../motion/button/stateful";
import { PRESS_SCALE, SPRING_PRESS } from "../../lib/ease";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";
import { Spinner } from "./spinner";

export type { ButtonState };

/* Buttons (Figma frame 67:1205, the reviewed Button sheet): three sizes and
   three looks.

   Sizes — sm 28px with the 13px Label; md 32px and lg 36px with Label Large
   (text-label-lg, 15/16). Radius 8px for sm and md, 12px for lg. `default`
   is md, `xs` is sm and `xl` is lg, so older call sites keep working. Icons
   are 16px. The side that holds an icon (a leading svg as the first child,
   a trailing one as the last) gets 2px less inline padding than the text
   side: sm 10 / 8, md 12 / 10, lg 16 / 14. CSS can't see text nodes (an svg
   after "View all" is also :first-child), so Button marks which ends of its
   children are elements (data-icon-start / data-icon-end) and the rule needs
   both. Icon-only buttons stay circles.

   Press — 0.97, the one press scale (standard.md §6). A Motion button
   presses through whileTap on SPRING_PRESS; a button drawn through
   `render` (or buttonVariants on another element) presses through the
   active:scale class. Never both: the CSS `scale` and Motion's `transform`
   multiply, which is how every button once pressed to 0.92.

   Hover — instant. Colours, borders and shadows switch with no transition
   and nothing grows: hover is the most frequent interaction there is.

   Looks —
   - primary (and `default`): the dark neutral-11 fill, white label, muted
     trailing icon.
   - secondary / outline: card fill, the subtle hairline and the button
     shadow.
   - quiet: the field grey with no border or shadow at rest, white with a
     hairline on hover (Settings, on the grey page).
   - ghost: no fill, the ghost grey label. Selected (aria-selected, as a tab)
     or pressed (aria-pressed, as a toggle) it takes the card fill, hairline
     and shadow.
   - brand: solid beUI blue with the solid focus ring; soft: tinted primary;
     destructive / destructive-outline: rose; link: underlined text (Figma color/text/default). */
export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap border outline-none transition-[scale] duration-fast ease-out select-none active:scale-[0.97] disabled:active:scale-100 [-webkit-tap-highlight-color:transparent] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-loading:select-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        sm: "h-7 rounded-md px-2.5 text-xs font-medium data-icon-start:has-[>svg:first-child]:ps-2 data-icon-end:has-[>svg:last-child]:pe-2",
        xs: "h-7 rounded-md px-2.5 text-xs font-medium data-icon-start:has-[>svg:first-child]:ps-2 data-icon-end:has-[>svg:last-child]:pe-2",
        md: "h-8 rounded-md px-3 text-label-lg data-icon-start:has-[>svg:first-child]:ps-2.5 data-icon-end:has-[>svg:last-child]:pe-2.5",
        default: "h-8 rounded-md px-3 text-label-lg data-icon-start:has-[>svg:first-child]:ps-2.5 data-icon-end:has-[>svg:last-child]:pe-2.5",
        lg: "h-9 rounded-xl px-4 text-label-lg data-icon-start:has-[>svg:first-child]:ps-3.5 data-icon-end:has-[>svg:last-child]:pe-3.5",
        xl: "h-9 rounded-xl px-4 text-label-lg data-icon-start:has-[>svg:first-child]:ps-3.5 data-icon-end:has-[>svg:last-child]:pe-3.5",
        icon: "size-9 rounded-full",
        "icon-lg": "size-11 rounded-full",
        "icon-sm": "size-8 rounded-full",
        "icon-xl": "size-12 rounded-full [&_svg:not([class*='size-'])]:size-5",
        "icon-xs": "size-7 rounded-full [&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        /* Brainn: the icon takes the label's colour; a muted grey icon on the solid
           fill looked washed out, most of all on an icon-only button. */
        primary:
          "border-btn-primary bg-btn-primary text-btn-primary-fg hover:bg-btn-primary/88 [&_svg]:text-btn-primary-fg *:data-[slot=button-loading-indicator]:text-btn-primary-fg",
        default:
          "border-btn-primary bg-btn-primary text-btn-primary-fg hover:bg-btn-primary/88 [&_svg]:text-btn-primary-fg *:data-[slot=button-loading-indicator]:text-btn-primary-fg",
        brand:
          "border-transparent bg-primary text-primary-foreground shadow-button hover:bg-primary/90 focus-visible:ring-0 focus-visible:ring-offset-0 focus-ring-brand *:data-[slot=button-loading-indicator]:text-primary-foreground",
        soft:
          "border-transparent bg-primary-soft text-primary-ink hover:bg-primary/15 *:data-[slot=button-loading-indicator]:text-primary-ink",
        destructive:
          "border-transparent bg-destructive text-destructive-on shadow-button hover:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-destructive-on",
        /* Archive in the Transactions side panel: the soft red fill, its text and icon in the red ink. */
        "destructive-soft":
          "border-transparent bg-neg-soft text-neg-ink hover:bg-[color-mix(in_srgb,var(--neg-soft)_80%,var(--neg)_20%)] [&_svg]:text-neg-ink *:data-[slot=button-loading-indicator]:text-neg-ink",
        "destructive-outline":
          "border-border-subtle bg-card text-destructive-foreground shadow-button hover:border-rose-ring hover:bg-neg-soft *:data-[slot=button-loading-indicator]:text-foreground",
        ghost:
          "border-transparent bg-transparent text-btn-ghost-fg hover:bg-card/70 hover:text-foreground aria-selected:border-border-subtle aria-selected:bg-card aria-selected:text-text-figure aria-selected:shadow-button aria-pressed:border-border-subtle aria-pressed:bg-card aria-pressed:text-text-figure aria-pressed:shadow-button [&_svg]:text-icon-muted *:data-[slot=button-loading-indicator]:text-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:underline *:data-[slot=button-loading-indicator]:text-foreground",
        outline:
          "border-border-subtle bg-card text-foreground shadow-button hover:border-border-strong [&_svg]:text-icon-muted *:data-[slot=button-loading-indicator]:text-foreground",
        secondary:
          "border-border-subtle bg-card text-foreground shadow-button hover:border-border-strong [&_svg]:text-icon-muted *:data-[slot=button-loading-indicator]:text-foreground",
        /* The quiet secondary (Settings): the field grey, no border or shadow
           at rest; on the grey page it lifts to white with a hairline. */
        quiet:
          "border-transparent bg-field text-foreground hover:bg-card hover:shadow-[0_0_0_1px_var(--border-subtle),var(--button-shadow)] [&_svg]:text-icon-muted *:data-[slot=button-loading-indicator]:text-foreground",
      },
    },
  },
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const reduce = useAppReducedMotion();
  const useMotion = render == null;
  const isDisabled: boolean = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  /* Which ends of the label are elements rather than text: see the padding
     note on buttonVariants. */
  const parts = React.Children.toArray(children);
  const isText = (n: React.ReactNode) => typeof n === "string" || typeof n === "number";
  const iconStart = parts.length > 0 && !isText(parts[0]);
  const iconEnd = parts.length > 0 && !isText(parts[parts.length - 1]);

  const defaultProps = {
    children: (
      <>
        {children}
        {loading && (
          <Spinner
            className="pointer-events-none"
            data-slot="button-loading-indicator"
          />
        )}
      </>
    ),
    /* A Motion button presses through whileTap, so the class's own scale
       is turned off (see the press note on buttonVariants). */
    className: cn(buttonVariants({ size, variant }), useMotion && "active:scale-100", className),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    "data-icon-start": iconStart ? "" : undefined,
    "data-icon-end": iconEnd ? "" : undefined,
    disabled: isDisabled,
    type: typeValue,
    ...(useMotion
      ? {
          whileTap: reduce || isDisabled ? undefined : { scale: PRESS_SCALE },
          transition: SPRING_PRESS,
        }
      : {}),
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render: render ?? <motion.button />,
  });
}

const STATEFUL_VARIANT_MAP = {
  default: "primary",
  primary: "primary",
  secondary: "secondary",
  quiet: "secondary",
  ghost: "ghost",
  outline: "outline",
  link: "ghost",
  brand: "primary",
  soft: "secondary",
  destructive: "primary",
  "destructive-soft": "secondary",
  "destructive-outline": "outline",
} as const;

const STATEFUL_SIZE_MAP = {
  default: "md",
  md: "md",
  sm: "sm",
  lg: "lg",
  xl: "lg",
  xs: "sm",
  icon: "icon",
  "icon-sm": "icon",
  "icon-lg": "icon",
  "icon-xl": "icon",
  "icon-xs": "icon",
} as const;

export interface StatefulButtonProps
  extends Omit<MotionStatefulButtonProps, "variant" | "size" | "pressScale"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}

export function StatefulButton({
  variant = "default",
  size = "default",
  className,
  ...props
}: StatefulButtonProps): React.ReactElement {
  return (
    <MotionStatefulButton
      variant={STATEFUL_VARIANT_MAP[variant ?? "default"]}
      size={STATEFUL_SIZE_MAP[size ?? "default"]}
      pressScale={PRESS_SCALE}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
