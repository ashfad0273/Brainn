"use client";

import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import { animate } from "motion/react";
import * as React from "react";
import { useAppReducedMotion } from "../../lib/motion";
import { type FieldIcon, FieldIconSlot } from "./field-icon";
import { cn } from "../../lib/utils";

export type TextareaProps = React.ComponentPropsWithoutRef<"textarea"> &
  React.RefAttributes<HTMLTextAreaElement> & {
    size?: "sm" | "default" | "lg" | number;
    unstyled?: boolean;
  };

/** beUI field surface for multiline input — same corners as every other form control. */
const textareaSurfaceClassName =
  "relative inline-flex w-full overflow-hidden rounded-xl border border-input bg-card shadow-xs text-sm text-foreground hover:border-border-strong has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/20 has-aria-invalid:border-destructive/60 has-aria-invalid:ring-2 has-aria-invalid:ring-destructive/20 has-[[data-invalid]]:border-destructive/60 has-[[data-invalid]]:ring-2 has-[[data-invalid]]:ring-destructive/20 has-disabled:opacity-64";

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

export function Textarea({
  className,
  size = "default",
  unstyled = false,
  leadingIcon,
  ref,
  ...props
}: TextareaProps & {
  /* Muted Remix icon at the top start of the field: `leadingIcon={Icons.notes}`. */
  leadingIcon?: FieldIcon;
}): React.ReactElement {
  const shellRef = React.useRef<HTMLSpanElement>(null);
  useShakeOnInvalid(shellRef);

  return (
    <span
      ref={shellRef}
      className={
        cn(!unstyled && textareaSurfaceClassName, className) || undefined
      }
      data-size={size}
      data-slot="textarea-control"
    >
      <FieldIconSlot icon={leadingIcon} className="items-start pt-2.5" />
      <FieldPrimitive.Control
        ref={ref}
        value={props.value}
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={props.id}
        name={props.name}
        render={(defaultProps: React.ComponentProps<"textarea">) => (
          <textarea
            className={cn(
              "field-sizing-content min-h-20 w-full rounded-[inherit] bg-transparent px-3 py-2 text-sm leading-5 text-foreground caret-foreground outline-none placeholder:text-muted-foreground",
              size === "sm" && "min-h-16 py-1.5",
              size === "lg" && "min-h-24 py-2.5",
              leadingIcon && "ps-2",
            )}
            data-slot="textarea"
            {...mergeProps(defaultProps, props)}
          />
        )}
      />
    </span>
  );
}

export { FieldPrimitive };
