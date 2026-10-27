"use client";

import { Input as InputPrimitive } from "@base-ui/react/input";
import { animate } from "motion/react";
import * as React from "react";
import { type FieldIcon, FieldIconSlot } from "./field-icon";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";

export type InputProps = Omit<
  InputPrimitive.Props & React.RefAttributes<HTMLInputElement>,
  "size"
> & {
  size?: "sm" | "default" | "lg" | number;
  unstyled?: boolean;
  nativeInput?: boolean;
  /* Muted Remix icon at the start of the field: `leadingIcon={Icons.date}`. */
  leadingIcon?: FieldIcon;
  /* `quiet`: the 32px Settings field on the grey fill, no outline at rest. */
  variant?: "default" | "quiet";
  /* Quiet only: a short unit inside the field, before or after the value
     ("৳", "%"). */
  addonStart?: React.ReactNode;
  addonEnd?: React.ReactNode;
};

const fieldSurfaceClassName =
  "relative inline-flex h-11 w-full items-center overflow-hidden rounded-xl border border-input bg-card shadow-xs text-sm text-foreground hover:border-border-strong has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/20 has-aria-invalid:border-destructive/60 has-aria-invalid:ring-2 has-aria-invalid:ring-destructive/20 has-[[data-invalid]]:border-destructive/60 has-[[data-invalid]]:ring-2 has-[[data-invalid]]:ring-destructive/20 has-disabled:opacity-64 data-[size=sm]:h-8 data-[size=lg]:h-12";

/* The quiet field (Settings, approved Oct 2026): 32px, the field grey with
   no outline at rest. On the grey page it lifts to white with a hairline on
   hover; focused it is white with a strong inset line and a soft halo. */
export const quietFieldClassName =
  "relative inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md bg-field px-2.5 text-sm hover:bg-card hover:shadow-[0_0_0_1px_var(--border-subtle),var(--button-shadow)] focus-within:bg-card focus-within:shadow-[inset_0_0_0_1px_var(--border-strong),0_0_0_3px_color-mix(in_srgb,var(--ring)_16%,transparent)] focus-within:hover:shadow-[inset_0_0_0_1px_var(--border-strong),0_0_0_3px_color-mix(in_srgb,var(--ring)_16%,transparent)] has-[[aria-invalid=true]]:shadow-[inset_0_0_0_1px_var(--destructive)] has-disabled:opacity-64";

export const quietInputClassName =
  "h-full w-full min-w-0 flex-1 border-0 bg-transparent font-medium text-sm text-text-figure caret-foreground outline-none placeholder:font-normal placeholder:text-text-tertiary";

function useShakeOnInvalid(
  containerRef: React.RefObject<HTMLElement | null>,
): void {
  const reduce = useAppReducedMotion();
  const wasInvalid = React.useRef(false);

  React.useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const readInvalid = () =>
      Boolean(
        root.querySelector(
          '[aria-invalid="true"], [data-invalid], [data-invalid="true"]',
        ),
      );

    const maybeShake = () => {
      const invalid = readInvalid();
      if (invalid && !wasInvalid.current && !reduce) {
        // allow-slow-duration: error shake, a deliberate 450ms feedback cue
        animate(root, { x: [0, -6, 6, -4, 4, -2, 0] }, { duration: 0.45 });
      }
      wasInvalid.current = invalid;
    };

    maybeShake();
    const mo = new MutationObserver(maybeShake);
    mo.observe(root, {
      attributes: true,
      subtree: true,
      attributeFilter: ["aria-invalid", "data-invalid"],
    });
    return () => mo.disconnect();
  }, [containerRef, reduce]);
}

export function Input({
  className,
  size = "default",
  unstyled = false,
  nativeInput = false,
  leadingIcon,
  variant = "default",
  addonStart,
  addonEnd,
  style,
  ...props
}: InputProps): React.ReactElement {
  const shellRef = React.useRef<HTMLSpanElement>(null);
  useShakeOnInvalid(shellRef);
  const quiet = variant === "quiet";

  const inputClassName = cn(
    quiet
      ? quietInputClassName
      : "h-full w-full min-w-0 rounded-[inherit] bg-transparent px-3 text-sm leading-5 text-foreground caret-foreground outline-none placeholder:text-muted-foreground",
    props.type === "search" &&
      "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
    leadingIcon && !quiet && "ps-2",
    props.type === "file" &&
      "text-muted-foreground file:me-3 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
  );

  return (
    <span
      ref={shellRef}
      className={
        cn(
          !unstyled && (quiet ? quietFieldClassName : fieldSurfaceClassName),
          className,
        ) || undefined
      }
      data-size={size}
      data-slot="input-control"
      data-variant={quiet ? "quiet" : undefined}
    >
      <FieldIconSlot icon={leadingIcon} />
      {quiet && addonStart != null ? (
        <span className="shrink-0 text-sm text-text-secondary">{addonStart}</span>
      ) : null}
      {nativeInput ? (
        <input
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={typeof style === "function" ? undefined : style}
          {...props}
        />
      ) : (
        <InputPrimitive
          className={inputClassName}
          data-slot="input"
          size={typeof size === "number" ? size : undefined}
          style={style}
          {...props}
        />
      )}
      {quiet && addonEnd != null ? (
        <span className="shrink-0 text-sm text-text-secondary">{addonEnd}</span>
      ) : null}
    </span>
  );
}

export { InputPrimitive };
