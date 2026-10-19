import * as React from "react"
import { Slot, Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "../../lib/utils"

/** A mouse (or pen) that can hover: the only pointer a tooltip is for. A touch screen gets none — it would sit in the way of taps. */
const FINE = "(hover: hover) and (pointer: fine)"

function subscribeFine(cb: () => void) {
  const mq = window.matchMedia(FINE)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

/** Whether the device has a hovering pointer — the desk, not a touch screen. */
export function useFinePointer(): boolean {
  return React.useSyncExternalStore(subscribeFine, () => window.matchMedia(FINE).matches, () => false)
}

const TooltipEnabled = React.createContext(true)

/** Mounted once, around the whole app (the shell). Sets the hover delay every tooltip shares. */
function TooltipProvider({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delayDuration={delayDuration} {...props} />
}

/**
 * The name of an icon Button, shown on hover and keyboard focus on the desk
 * and never on a touch screen. The Button keeps its `aria-label`; the tooltip
 * shows that name, it doesn't replace it. `title=` is not a tooltip.
 *
 *   <Tooltip>
 *     <TooltipTrigger asChild><Button size="icon" aria-label="New folder">…</Button></TooltipTrigger>
 *     <TooltipContent>New folder</TooltipContent>
 *   </Tooltip>
 */
function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  const fine = useFinePointer()
  if (!fine) return <TooltipEnabled.Provider value={false}>{props.children}</TooltipEnabled.Provider>
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ asChild, ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  const enabled = React.useContext(TooltipEnabled)
  if (!enabled) {
    const Comp = asChild ? Slot.Root : "button"
    return <Comp data-slot="tooltip-trigger" {...(asChild ? {} : { type: "button" as const })} {...props} />
  }
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" asChild={asChild} {...props} />
}

function TooltipContent({ className, sideOffset = 4, children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const enabled = React.useContext(TooltipEnabled)
  if (!enabled) return null
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "bg-foreground text-background z-50 w-fit max-w-xs rounded-md px-2 py-1 text-xs text-balance animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * The common case in one: an icon Button named `label`, which it also carries
 * as its `aria-label` — `<Tip label="New folder"><Button size="icon" aria-label="New folder">…</Button></Tip>`.
 * Wraps a trigger too (`<DropdownMenuTrigger asChild>`), outermost.
 */
function Tip({ label, side, children }: { label: React.ReactNode; side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]; children: React.ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Tip }
