"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Icons } from "../../lib/icons";
import * as React from "react";
import { useAppReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";

export const MenuCreateHandle: typeof MenuPrimitive.createHandle =
  MenuPrimitive.createHandle;

export const Menu: typeof MenuPrimitive.Root = MenuPrimitive.Root;

export const MenuPortal: typeof MenuPrimitive.Portal = MenuPrimitive.Portal;

const MenuSurfaceContext = React.createContext<{
  id: string;
  reduce: boolean;
} | null>(null);

function useDataHighlighted(
  ref: React.RefObject<HTMLElement | null>,
): boolean {
  const [highlighted, setHighlighted] = React.useState(false);

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const sync = () => setHighlighted(node.hasAttribute("data-highlighted"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(node, {
      attributes: true,
      attributeFilter: ["data-highlighted"],
    });
    return () => observer.disconnect();
  }, [ref]);

  return highlighted;
}

function MenuActiveRow({
  active,
  destructive = false,
}: {
  active: boolean;
  destructive?: boolean;
}): React.ReactElement | null {
  const surface = React.useContext(MenuSurfaceContext);
  if (!active || !surface) return null;
  return (
    /* The highlight switches rows instantly: it follows the pointer and the
       arrow keys, the most frequent thing a menu does, so it never slides. */
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 col-span-full row-span-full rounded-pop-row",
        destructive ? "bg-neg-soft" : "bg-muted",
      )}
    />
  );
}

export function MenuTrigger({
  className,
  children,
  ...props
}: MenuPrimitive.Trigger.Props): React.ReactElement {
  return (
    <MenuPrimitive.Trigger
      className={className}
      data-slot="menu-trigger"
      {...props}
    >
      {children}
    </MenuPrimitive.Trigger>
  );
}

export function MenuPopup({
  children,
  className,
  sideOffset = 4,
  align = "center",
  alignOffset,
  side = "bottom",
  anchor,
  portalProps,
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
  side?: MenuPrimitive.Positioner.Props["side"];
  anchor?: MenuPrimitive.Positioner.Props["anchor"];
  portalProps?: MenuPrimitive.Portal.Props;
}): React.ReactElement {
  const menuId = React.useId();
  const reduce = useAppReducedMotion();

  return (
    <MenuPortal {...portalProps}>
      <MenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="z-50"
        data-slot="menu-positioner"
        side={side}
        sideOffset={sideOffset}
      >
        <MenuSurfaceContext.Provider value={{ id: menuId, reduce }}>
            <MenuPrimitive.Popup
              className={cn(
                "relative flex not-[class*='w-']:min-w-56 origin-(--transform-origin) rounded-pop glass not-dark:bg-clip-padding text-foreground outline-none focus:outline-none data-ending-style:opacity-0 data-starting-style:opacity-0",
                reduce
                  ? "transition-opacity duration-0"
                  : "transition-[scale,opacity] duration-150 ease-out data-ending-style:duration-100 data-ending-style:scale-[0.96] data-starting-style:scale-[0.96]",
                className,
              )}
              data-slot="menu-popup"
              {...props}
            >
              <div className="max-h-(--available-height) w-full overflow-y-auto p-1.5">
                {children}
              </div>
            </MenuPrimitive.Popup>
        </MenuSurfaceContext.Provider>
      </MenuPrimitive.Positioner>
    </MenuPortal>
  );
}

export function MenuGroup(
  props: MenuPrimitive.Group.Props,
): React.ReactElement {
  return <MenuPrimitive.Group data-slot="menu-group" {...props} />;
}

export function MenuItem({
  className,
  inset,
  variant = "default",
  children,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): React.ReactElement {
  const itemRef = React.useRef<HTMLElement | null>(null);
  const highlighted = useDataHighlighted(itemRef);

  return (
    <MenuPrimitive.Item
      className={cn(
        "relative isolate flex min-h-8 cursor-default select-none items-center gap-2 rounded-pop-row px-2.5 py-1.5 text-base text-foreground outline-none data-disabled:pointer-events-none data-inset:ps-8 data-[variant=destructive]:text-destructive data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
        className,
      )}
      data-inset={inset}
      data-slot="menu-item"
      data-variant={variant}
      {...props}
      ref={itemRef}
    >
      <MenuActiveRow
        active={highlighted}
        destructive={variant === "destructive"}
      />
      {children}
    </MenuPrimitive.Item>
  );
}

export function MenuLinkItem({
  className,
  inset,
  variant = "default",
  closeOnClick = true,
  children,
  ...props
}: MenuPrimitive.LinkItem.Props & {
  inset?: boolean;
  variant?: "default" | "destructive";
}): React.ReactElement {
  const itemRef = React.useRef<HTMLElement | null>(null);
  const highlighted = useDataHighlighted(itemRef);

  return (
    <MenuPrimitive.LinkItem
      className={cn(
        "relative isolate flex min-h-8 cursor-default select-none items-center gap-2 rounded-pop-row px-2.5 py-1.5 text-base text-foreground outline-none data-disabled:pointer-events-none data-inset:ps-8 data-[variant=destructive]:text-destructive data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:-mx-0.5 [&>svg]:shrink-0",
        className,
      )}
      closeOnClick={closeOnClick}
      data-inset={inset}
      data-slot="menu-link-item"
      data-variant={variant}
      {...props}
      ref={itemRef}
    >
      <MenuActiveRow
        active={highlighted}
        destructive={variant === "destructive"}
      />
      {children}
    </MenuPrimitive.LinkItem>
  );
}

export function MenuCheckboxItem({
  className,
  children,
  checked,
  variant = "default",
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  variant?: "default" | "switch";
}): React.ReactElement {
  const itemRef = React.useRef<HTMLElement | null>(null);
  const highlighted = useDataHighlighted(itemRef);

  return (
    <MenuPrimitive.CheckboxItem
      checked={checked}
      className={cn(
        "relative isolate grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default items-center gap-2 rounded-pop-row py-1.5 ps-2.5 text-base text-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        variant === "switch"
          ? "grid-cols-[1fr_auto] gap-4 pe-1.5"
          : "grid-cols-[.75rem_1fr] pe-4",
        className,
      )}
      data-slot="menu-checkbox-item"
      {...props}
      ref={itemRef}
    >
      <MenuActiveRow active={highlighted} />
      {variant === "switch" ? (
        <>
          <span className="col-start-1 row-start-1">{children}</span>
          <MenuPrimitive.CheckboxItemIndicator
            className="col-start-2 row-start-1 inset-shadow-[0_1px_--theme(--color-black/4%)] inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-fast [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
            keepMounted
          >
            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s,border-radius_.15s,scale_.1s_.1s,transform-origin_.15s]" />
          </MenuPrimitive.CheckboxItemIndicator>
        </>
      ) : (
        <>
          <MenuPrimitive.CheckboxItemIndicator className="col-start-1 row-start-1 -ms-0.5">
            <Icons.check aria-hidden />
          </MenuPrimitive.CheckboxItemIndicator>
          <span className="col-start-2 row-start-1">{children}</span>
        </>
      )}
    </MenuPrimitive.CheckboxItem>
  );
}

export function MenuRadioGroup(
  props: MenuPrimitive.RadioGroup.Props,
): React.ReactElement {
  return <MenuPrimitive.RadioGroup data-slot="menu-radio-group" {...props} />;
}

export function MenuRadioItem({
  className,
  children,
  ...props
}: MenuPrimitive.RadioItem.Props): React.ReactElement {
  const itemRef = React.useRef<HTMLElement | null>(null);
  const highlighted = useDataHighlighted(itemRef);

  return (
    <MenuPrimitive.RadioItem
      className={cn(
        "relative isolate grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[.75rem_1fr] items-center gap-2 rounded-pop-row py-1.5 ps-2.5 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="menu-radio-item"
      {...props}
      ref={itemRef}
    >
      <MenuActiveRow active={highlighted} />
      <MenuPrimitive.RadioItemIndicator className="col-start-1 row-start-1 -ms-0.5">
        <Icons.check aria-hidden />
      </MenuPrimitive.RadioItemIndicator>
      <span className="col-start-2 row-start-1">{children}</span>
    </MenuPrimitive.RadioItem>
  );
}

export function MenuGroupLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  inset?: boolean;
}): React.ReactElement {
  return (
    <MenuPrimitive.GroupLabel
      className={cn(
        "px-2.5 py-1.5 text-label-mono text-muted-foreground data-inset:ps-9 sm:data-inset:ps-8",
        className,
      )}
      data-inset={inset}
      data-slot="menu-label"
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: MenuPrimitive.Separator.Props): React.ReactElement {
  return (
    <MenuPrimitive.Separator
      className={cn("mx-2 my-1 h-px bg-border", className)}
      data-slot="menu-separator"
      {...props}
    />
  );
}

export function MenuShortcut({
  className,
  ...props
}: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <kbd
      className={cn(
        "ms-auto font-normal font-sans text-muted-foreground text-xs tracking-widest",
        className,
      )}
      data-slot="menu-shortcut"
      {...props}
    />
  );
}

export function MenuSub(
  props: MenuPrimitive.SubmenuRoot.Props,
): React.ReactElement {
  return <MenuPrimitive.SubmenuRoot data-slot="menu-sub" {...props} />;
}

export function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean;
}): React.ReactElement {
  const itemRef = React.useRef<HTMLElement | null>(null);
  const highlighted = useDataHighlighted(itemRef);

  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        "relative isolate flex min-h-8 items-center gap-2 rounded-pop-row px-2.5 py-1.5 text-base text-foreground outline-none data-disabled:pointer-events-none data-inset:ps-8 data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not(:last-child)]:-mx-0.5 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      )}
      data-inset={inset}
      data-slot="menu-sub-trigger"
      {...props}
      ref={itemRef}
    >
      <MenuActiveRow active={highlighted} />
      {children}
      <Icons.chevronRight className="ms-auto -me-0.5 opacity-80" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

export function MenuSubPopup({
  className,
  sideOffset = 0,
  alignOffset,
  align = "start",
  ...props
}: MenuPrimitive.Popup.Props & {
  align?: MenuPrimitive.Positioner.Props["align"];
  sideOffset?: MenuPrimitive.Positioner.Props["sideOffset"];
  alignOffset?: MenuPrimitive.Positioner.Props["alignOffset"];
}): React.ReactElement {
  const defaultAlignOffset = align !== "center" ? -5 : undefined;

  return (
    <MenuPopup
      align={align}
      alignOffset={alignOffset ?? defaultAlignOffset}
      className={className}
      data-slot="menu-sub-content"
      side="inline-end"
      sideOffset={sideOffset}
      {...props}
    />
  );
}

export {
  MenuPrimitive,
  MenuCreateHandle as DropdownMenuCreateHandle,
  Menu as DropdownMenu,
  MenuPortal as DropdownMenuPortal,
  MenuTrigger as DropdownMenuTrigger,
  MenuPopup as DropdownMenuContent,
  MenuGroup as DropdownMenuGroup,
  MenuItem as DropdownMenuItem,
  MenuCheckboxItem as DropdownMenuCheckboxItem,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem as DropdownMenuRadioItem,
  MenuGroupLabel as DropdownMenuLabel,
  MenuSeparator as DropdownMenuSeparator,
  MenuShortcut as DropdownMenuShortcut,
  MenuSub as DropdownMenuSub,
  MenuSubTrigger as DropdownMenuSubTrigger,
  MenuSubPopup as DropdownMenuSubContent,
};
