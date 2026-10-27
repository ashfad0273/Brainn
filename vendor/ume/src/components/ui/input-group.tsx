"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { animate } from "motion/react";
import * as React from "react";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";
import { Input, type InputProps } from "./input";
import { Textarea, type TextareaProps } from "./textarea";

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text select-none items-center justify-center gap-2 leading-none [&>kbd]:rounded-[calc(var(--radius)-5px)] [&_svg:not([class*='size-'])]:size-4 [&>svg]:text-muted-foreground [&_svg]:-mx-0.5",
  {
    defaultVariants: {
      align: "inline-start",
    },
    variants: {
      align: {
        "block-end":
          "order-last w-full justify-start px-3 pb-3 [.border-t]:pt-3",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 [.border-b]:pb-3",
        "inline-end":
          "order-last pe-3 has-[>:last-child[data-slot=badge]]:-me-1.5 has-[>button]:-me-2 has-[>kbd:last-child]:me-[-0.35rem]",
        "inline-start":
          "order-first ps-3 has-[>:last-child[data-slot=badge]]:-ms-1.5 has-[>button]:-ms-2 has-[>kbd:last-child]:ms-[-0.35rem]",
      },
    },
  },
);

const inputGroupSurfaceClassName =
  "relative inline-flex h-11 w-full min-w-0 items-center overflow-hidden rounded-xl border border-input bg-card shadow-xs text-sm text-foreground hover:border-border-strong has-[[data-slot=input-control][data-size=sm]]:h-8 has-[[data-slot=input-control][data-size=lg]]:h-12 has-[input:focus-visible,textarea:focus-visible]:border-ring has-[input:focus-visible,textarea:focus-visible]:ring-3 has-[input:focus-visible,textarea:focus-visible]:ring-ring/20 has-[input[aria-invalid=true],textarea[aria-invalid=true],[data-invalid]]:border-destructive/60 has-[input[aria-invalid=true],textarea[aria-invalid=true],[data-invalid]]:ring-2 has-[input[aria-invalid=true],textarea[aria-invalid=true],[data-invalid]]:ring-destructive/20 has-[textarea]:h-auto has-data-[align=block-end]:h-auto has-data-[align=block-start]:h-auto has-data-[align=block-end]:flex-col has-data-[align=block-start]:flex-col has-[input:disabled,textarea:disabled]:opacity-64 *:[[data-slot=input-control],[data-slot=textarea-control]]:contents *:[[data-slot=input-control],[data-slot=textarea-control]]:before:hidden has-[[data-align=block-start],[data-align=block-end]]:**:[input]:h-auto has-data-[align=inline-start]:**:[input]:ps-2 has-data-[align=inline-end]:**:[input]:pe-2 has-data-[align=block-end]:**:[input]:pt-1.5 has-data-[align=block-start]:**:[input]:pb-1.5 **:[textarea]:min-h-20 **:[textarea]:resize-none **:[textarea]:py-3 **:[textarea_button]:rounded-xl";

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

export function InputGroup({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  const shellRef = React.useRef<HTMLDivElement>(null);
  useShakeOnInvalid(shellRef);

  return (
    <div
      ref={shellRef}
      className={cn(inputGroupSurfaceClassName, className)}
      data-slot="input-group"
      role="group"
      {...props}
    />
  );
}

export function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof inputGroupAddonVariants>): React.ReactElement {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest(
          "button, a, input, select, textarea, [role='button'], [role='combobox'], [role='listbox'], [data-slot='select-trigger']",
        );
        if (isInteractive) return;
        e.preventDefault();
        const parent = e.currentTarget.parentElement;
        const input = parent?.querySelector<
          HTMLInputElement | HTMLTextAreaElement
        >("input, textarea");
        if (input && !parent?.querySelector("input:focus, textarea:focus")) {
          input.focus();
        }
      }}
      {...props}
    />
  );
}

export function InputGroupText({
  className,
  ...props
}: React.ComponentProps<"span">): React.ReactElement {
  return (
    <span
      className={cn(
        "line-clamp-1 flex items-center gap-2 whitespace-nowrap text-muted-foreground leading-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5",
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupInput({
  className,
  ...props
}: InputProps): React.ReactElement {
  return <Input className={className} unstyled {...props} />;
}

export function InputGroupTextarea({
  className,
  ...props
}: TextareaProps): React.ReactElement {
  return <Textarea className={className} unstyled {...props} />;
}
