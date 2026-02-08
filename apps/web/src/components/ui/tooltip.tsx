"use client";

import type { ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "../../lib/utils";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

export function Tooltip({ content, children, className, "aria-label": ariaLabel }: TooltipProps) {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          delay={0}
          aria-label={ariaLabel}
          className={cn("inline-flex cursor-default", className)}
        >
          {children}
        </BaseTooltip.Trigger>
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner sideOffset={6} className="z-[100]">
            <BaseTooltip.Popup
              className={cn(
                "max-w-xs rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md",
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}
