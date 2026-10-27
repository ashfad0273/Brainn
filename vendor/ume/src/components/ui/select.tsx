"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { Icons } from "../../lib/icons";
import * as React from "react";
import { useAppReducedMotion } from "../../lib/motion";
import { type FieldIcon, FieldIconSlot } from "./field-icon";
import { cn } from "../../lib/utils";

function useDataHighlighted(
  ref: React.RefObject<HTMLElement | null>,
): boolean {
  const [highlighted, setHighlighted] = React.useState(false);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setHighlighted(el.hasAttribute("data-highlighted"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(el, {
      attributes: true,
      attributeFilter: ["data-highlighted"],
    });
    return () => observer.disconnect();
  }, []);
  return highlighted;
}

export function Select<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>,
): React.ReactElement {
  return <SelectPrimitive.Root {...props} />;
}

export const selectTriggerVariants = cva(
  "relative inline-flex h-11 w-full min-w-36 select-none items-center justify-between gap-2 rounded-xl border border-input bg-card shadow-xs px-3 text-left text-sm text-foreground outline-none pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 aria-invalid:border-destructive/60 aria-invalid:ring-2 aria-invalid:ring-destructive/20 data-invalid:border-destructive/60 data-invalid:ring-2 data-invalid:ring-destructive/20 data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "",
        lg: "h-12",
        sm: "h-8 gap-1.5",
      },
    },
  },
);

export const selectTriggerIconClassName = "-me-1 size-4 text-muted-foreground";

/* The quiet picker (Settings, approved Oct 2026): a 32px pill on the field
   grey that hugs its value, with a muted chevron-down. It lifts to white
   with a hairline on hover and while its menu is open. */
export const selectQuietClassName =
  "relative inline-flex h-8 min-w-0 max-w-full cursor-pointer select-none items-center gap-1 rounded-md bg-field ps-2.5 pe-2 text-start font-medium text-sm text-text-figure outline-none pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 hover:bg-card hover:shadow-[0_0_0_1px_var(--border-subtle),var(--button-shadow)] focus-visible:ring-[1.5px] focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-expanded:bg-card aria-expanded:shadow-[0_0_0_1px_var(--border-subtle),var(--button-shadow)] data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-icon-muted";

export interface SelectButtonProps extends useRender.ComponentProps<"button"> {
  size?: VariantProps<typeof selectTriggerVariants>["size"];
  leadingIcon?: FieldIcon;
  /* `quiet`: the Settings picker (see selectQuietClassName). */
  variant?: "default" | "quiet";
}

export function SelectButton({
  className,
  size,
  render,
  children,
  leadingIcon,
  variant = "default",
  ...props
}: SelectButtonProps): React.ReactElement {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";
  const quiet = variant === "quiet";

  const defaultProps = {
    children: quiet ? (
      <>
        <FieldIconSlot icon={leadingIcon} className="ps-0" />
        <span className="truncate">{children}</span>
        <Icons.chevronDown aria-hidden />
      </>
    ) : (
      <>
        <FieldIconSlot icon={leadingIcon} className="-me-0.5" />
        <span className="flex-1 truncate in-data-placeholder:text-muted-foreground">
          {children}
        </span>
        <Icons.chevronsUpDown className={selectTriggerIconClassName} />
      </>
    ),
    className: quiet
      ? cn(selectQuietClassName, className)
      : cn(selectTriggerVariants({ size }), "min-w-0", leadingIcon && "ps-0", className),
    "data-slot": "select-button",
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

export function SelectTrigger({
  className,
  size = "default",
  leadingIcon,
  variant = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props &
  VariantProps<typeof selectTriggerVariants> & {
    /* Muted Remix icon at the start: `leadingIcon={Icons.category}`. */
    leadingIcon?: FieldIcon;
    /* `quiet`: the Settings picker that hugs its value (selectQuietClassName). */
    variant?: "default" | "quiet";
  }): React.ReactElement {
  const quiet = variant === "quiet";
  return (
    <SelectPrimitive.Trigger
      className={
        quiet
          ? cn(selectQuietClassName, "[&_[data-slot=select-value]]:flex-none", className)
          : cn(selectTriggerVariants({ size }), leadingIcon && "ps-0", className)
      }
      data-slot="select-trigger"
      {...props}
    >
      <FieldIconSlot icon={leadingIcon} className={quiet ? "ps-0" : "-me-0.5"} />
      {children}
      <SelectPrimitive.Icon data-slot="select-icon" className={quiet ? "flex" : undefined}>
        {quiet ? (
          <Icons.chevronDown aria-hidden />
        ) : (
          <Icons.chevronsUpDown className={selectTriggerIconClassName} />
        )}
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectValue({
  className,
  ...props
}: SelectPrimitive.Value.Props): React.ReactElement {
  return (
    <SelectPrimitive.Value
      className={cn(
        "flex-1 truncate data-placeholder:text-muted-foreground",
        className,
      )}
      data-slot="select-value"
      {...props}
    />
  );
}

export function SelectPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = true,
  anchor,
  portalProps,
  ...props
}: SelectPrimitive.Popup.Props & {
  portalProps?: SelectPrimitive.Portal.Props;
  side?: SelectPrimitive.Positioner.Props["side"];
  sideOffset?: SelectPrimitive.Positioner.Props["sideOffset"];
  align?: SelectPrimitive.Positioner.Props["align"];
  alignOffset?: SelectPrimitive.Positioner.Props["alignOffset"];
  alignItemWithTrigger?: SelectPrimitive.Positioner.Props["alignItemWithTrigger"];
  anchor?: SelectPrimitive.Positioner.Props["anchor"];
}): React.ReactElement {
  const reduce = useAppReducedMotion();

  return (
    <SelectPrimitive.Portal {...portalProps}>
      <SelectPrimitive.Positioner
        align={align}
        alignItemWithTrigger={alignItemWithTrigger}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50 select-none"
        data-slot="select-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          className={cn(
            "min-w-(--anchor-width) origin-(--transform-origin) rounded-pop glass text-foreground outline-none",
            reduce
              ? "data-ending-style:opacity-0 data-starting-style:opacity-0"
              : "transition-[scale,opacity] duration-150 ease-out data-ending-style:duration-100 data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0",
          )}
          data-slot="select-popup"
          {...props}
        >
          <SelectPrimitive.ScrollUpArrow
            className="top-0 z-50 flex h-6 w-full cursor-default items-center justify-center before:pointer-events-none before:absolute before:inset-x-px before:top-px before:h-full before:rounded-t-[calc(var(--radius-pop)-1px)] before:bg-popover"
            data-slot="select-scroll-up-arrow"
          >
            <Icons.chevronUp className="relative size-4 text-muted-foreground" />
          </SelectPrimitive.ScrollUpArrow>
          <SelectPrimitive.List
            className={cn(
              "relative isolate max-h-(--available-height) overflow-y-auto p-1.5",
              className,
            )}
            data-slot="select-list"
          >
            {children}
          </SelectPrimitive.List>
          <SelectPrimitive.ScrollDownArrow
            className="bottom-0 z-50 flex h-6 w-full cursor-default items-center justify-center before:pointer-events-none before:absolute before:inset-x-px before:bottom-px before:h-full before:rounded-b-[calc(var(--radius-pop)-1px)] before:bg-popover"
            data-slot="select-scroll-down-arrow"
          >
            <Icons.chevronDown className="relative size-4 text-muted-foreground" />
          </SelectPrimitive.ScrollDownArrow>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props): React.ReactElement {
  const itemRef = React.useRef<HTMLDivElement>(null);
  const highlighted = useDataHighlighted(itemRef);

  return (
    <SelectPrimitive.Item
      ref={itemRef}
      className={cn(
        "relative grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-pop-row py-1.5 ps-2 pe-4 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-64 data-highlighted:text-foreground not-data-highlighted:text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      {highlighted ? (
        /* Instant, like the menu's: the highlight never slides between rows. */
        <span aria-hidden className="absolute inset-0 -z-10 rounded-pop-row bg-muted" />
      ) : null}
      <SelectPrimitive.ItemIndicator className="col-start-1">
        <Icons.check aria-hidden />
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText className="col-start-2 min-w-0">
        {children}
      </SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props): React.ReactElement {
  return (
    <SelectPrimitive.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      data-slot="select-separator"
      {...props}
    />
  );
}

export function SelectGroup(
  props: SelectPrimitive.Group.Props,
): React.ReactElement {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

export function SelectLabel({
  className,
  ...props
}: SelectPrimitive.Label.Props): React.ReactElement {
  return (
    <SelectPrimitive.Label
      className={cn(
        "not-in-data-[slot=field]:mb-2 inline-flex cursor-default items-center gap-2 font-medium text-sm/4 text-foreground",
        className,
      )}
      data-slot="select-label"
      {...props}
    />
  );
}

export function SelectGroupLabel(
  props: SelectPrimitive.GroupLabel.Props,
): React.ReactElement {
  return (
    <SelectPrimitive.GroupLabel
      className="px-2 py-1.5 text-label-mono text-muted-foreground"
      data-slot="select-group-label"
      {...props}
    />
  );
}

export { SelectPrimitive, SelectPopup as SelectContent };
