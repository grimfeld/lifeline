import * as React from "react"

import { cn } from "../../lib/utils"

/**
 * A chip that turns one filter on or off (the map's App, Document type and To
 * try chips): a toggle button, `aria-pressed` for a screen reader, at least
 * 24px tall on the desk and 32px on a phone. The off state is a muted colour
 * on no fill, never faded, so its text keeps its contrast.
 */
function FilterChip({
  on,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "type" | "aria-pressed"> & { on: boolean }) {
  return (
    <button
      type="button"
      data-slot="filter-chip"
      aria-pressed={on}
      className={cn(
        "focus-visible:ring-ring flex min-h-6 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors focus-visible:ring-2 focus-visible:outline-none max-md:h-8 max-md:justify-center max-md:px-3",
        on ? "bg-accent" : "text-muted-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { FilterChip }
