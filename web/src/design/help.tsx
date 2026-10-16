import { useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CircleHelp } from "lucide-react";
import { useSurface } from "./surface";

/** Clickable (?) tip beside a Settings heading or control label. */
export function HelpTip({ subject, children }: { subject: string; children: string }) {
  const [open, setOpen] = useState(false);
  const surface = useSurface();
  const label = `About ${subject}`;
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className="ui-button ui-button-quiet ui-icon-button ui-help-tip-trigger"
          aria-label={label}
          title={label}
        >
          <CircleHelp size={16} aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          {...surface}
          aria-label={label}
          className="ui-popover ui-popover-compact ui-overlay-surface ui-help-tip"
          sideOffset={8}
          align="start"
          collisionPadding={12}
          avoidCollisions
          sticky="partial"
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <p className="ui-text ui-text-support ui-help-tip-body">{children}</p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
