"use client"

import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "../../lib/utils"
import { usePhone } from "./phone-dock"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

/**
 * A single-choice switch: segments, status chips, a shelf picker (ADR 0079).
 * On the desk it looks like `TabsList` — the choice in view raised on a muted
 * track — and is a radio group: arrow keys move between choices, a screen
 * reader hears the group's name and the checked choice. On a phone it is a
 * `Select` of the same items (ADR 0064), the way `TabsList` becomes one, so a
 * screen passes one component and the phone layout follows.
 *
 * Always one choice: clicking the chosen one again keeps it (Radix would
 * clear it). Name it with `aria-label` — the phone select carries it too.
 */
function ToggleGroup({
  className,
  value,
  onValueChange,
  children,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentProps<typeof ToggleGroupPrimitive.Root>, "type" | "value" | "defaultValue" | "onValueChange"> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const phone = usePhone()
  if (phone) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger data-slot="toggle-group" aria-label={ariaLabel} className={cn("min-w-0 *:data-[slot=select-value]:gap-1.5", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {itemsOf(children).map((t) => (
            <SelectItem key={t.value} value={t.value} disabled={t.disabled}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  // p-[3px]: TabsList's own track inset, so the two read as one control.
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      type="single"
      value={value}
      onValueChange={(v: string) => {
        if (v) onValueChange(v)
      }}
      aria-label={ariaLabel}
      className={cn(
        "bg-muted text-muted-foreground inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg p-[3px]",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Root>
  )
}

/** The items under a group, through fragments and conditionals, as select options. */
function itemsOf(children: React.ReactNode): { value: string; label: React.ReactNode; disabled?: boolean }[] {
  const out: { value: string; label: React.ReactNode; disabled?: boolean }[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean }
    if (child.type === ToggleGroupItem && props.value !== undefined) out.push({ value: props.value, label: props.children, disabled: props.disabled })
    else if (props.children) out.push(...itemsOf(props.children))
  })
  return out
}

/** One choice: the `TabsTrigger` look, raised (`bg-background shadow-sm`) when chosen. */
function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:border-input dark:data-[state=on]:bg-input/30 dark:data-[state=on]:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
