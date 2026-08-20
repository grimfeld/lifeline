import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "../../lib/utils"

/** Off-canvas panel (phone drawer, capture sheet). Radix Dialog under the hood, like dialog.tsx. */
function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

const sides = {
  left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r data-open:slide-in-from-left data-closed:slide-out-to-left",
  right: "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-open:slide-in-from-right data-closed:slide-out-to-right",
  bottom:
    "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
} as const

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: keyof typeof sides }) {
  return (
    <SheetPrimitive.Portal data-slot="sheet-portal">
      <SheetPrimitive.Overlay
        data-slot="sheet-overlay"
        className="fixed inset-0 z-50 bg-black/40 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
      />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background text-foreground fixed z-50 flex flex-col overflow-y-auto shadow-lg outline-none duration-200 data-open:animate-in data-closed:animate-out",
          sides[side],
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title data-slot="sheet-title" className={cn("px-4 pt-3 text-sm font-medium", className)} {...props} />
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle }
