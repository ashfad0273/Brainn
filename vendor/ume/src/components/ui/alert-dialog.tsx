"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type React from "react";
import { cn } from "../../lib/utils";

export const AlertDialogCreateHandle: typeof AlertDialogPrimitive.createHandle =
  AlertDialogPrimitive.createHandle;

export const AlertDialog: typeof AlertDialogPrimitive.Root =
  AlertDialogPrimitive.Root;

export const AlertDialogPortal: typeof AlertDialogPrimitive.Portal =
  AlertDialogPrimitive.Portal;

export function AlertDialogTrigger(
  props: AlertDialogPrimitive.Trigger.Props,
): React.ReactElement {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

export function AlertDialogBackdrop({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props): React.ReactElement {
  return (
    <AlertDialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-background/40 backdrop-blur-sm transition-opacity duration-200 ease-out data-ending-style:duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      data-slot="alert-dialog-backdrop"
      {...props}
    />
  );
}

export function AlertDialogViewport({
  className,
  ...props
}: AlertDialogPrimitive.Viewport.Props): React.ReactElement {
  return (
    <AlertDialogPrimitive.Viewport
      className={cn(
        "fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4",
        className,
      )}
      data-slot="alert-dialog-viewport"
      {...props}
    />
  );
}

export function AlertDialogPopup({
  className,
  bottomStickOnMobile = true,
  portalProps,
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  bottomStickOnMobile?: boolean;
  portalProps?: AlertDialogPrimitive.Portal.Props;
}): React.ReactElement {
  return (
    <AlertDialogPortal {...portalProps}>
      <AlertDialogBackdrop />
      <AlertDialogViewport
        className={cn(
          bottomStickOnMobile &&
            "max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12",
        )}
      >
        <AlertDialogPrimitive.Popup
          className={cn(
            "relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-lg origin-center flex-col overflow-hidden rounded-2xl glass text-foreground transition-[scale,opacity,translate] duration-200 ease-out data-ending-style:duration-150 data-ending-style:scale-[0.96] data-starting-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] after:pointer-events-none after:absolute after:inset-0 after:bg-background/50 after:opacity-0 after:transition-opacity after:duration-base after:ease-out data-nested-dialog-open:after:opacity-100",
            bottomStickOnMobile &&
              "max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:data-ending-style:scale-100 max-sm:data-starting-style:scale-100",
            className,
          )}
          data-slot="alert-dialog-popup"
          {...props}
        />
      </AlertDialogViewport>
    </AlertDialogPortal>
  );
}

export function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-6 text-center max-sm:pb-4 sm:text-left",
        className,
      )}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

export function AlertDialogFooter({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "bare";
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl)-1px)]",
        variant === "default" && "pt-2 pb-6",
        variant === "bare" && "pb-6",
        className,
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props): React.ReactElement {
  return (
    <AlertDialogPrimitive.Title
      className={cn(
        "font-heading font-medium text-xl leading-none text-foreground",
        className,
      )}
      data-slot="alert-dialog-title"
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props): React.ReactElement {
  return (
    <AlertDialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

export function AlertDialogClose(
  props: AlertDialogPrimitive.Close.Props,
): React.ReactElement {
  return (
    <AlertDialogPrimitive.Close data-slot="alert-dialog-close" {...props} />
  );
}

export {
  AlertDialogPrimitive,
  AlertDialogBackdrop as AlertDialogOverlay,
  AlertDialogPopup as AlertDialogContent,
};
