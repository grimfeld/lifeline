"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "../../lib/utils"
import { usePhone } from "./phone-dock"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"

/**
 * The value in view, held here as well as by Radix: on a phone the list is a
 * select (tabs are cramped and fiddly under a thumb), and the select needs the
 * value Radix does not share.
 */
const TabsValue = React.createContext<{ value: string | undefined; setValue: (v: string) => void } | null>(null)

function Tabs({
  className,
  orientation = "horizontal",
  value: controlled,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue)
  const value = controlled ?? uncontrolled
  const setValue = React.useCallback(
    (v: string) => {
      if (controlled === undefined) setUncontrolled(v)
      onValueChange?.(v)
    },
    [controlled, onValueChange]
  )
  return (
    <TabsValue.Provider value={{ value, setValue }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        className={cn(
          "group/tabs flex gap-2 data-horizontal:flex-col",
          className
        )}
        value={value}
        onValueChange={setValue}
        {...props}
      />
    </TabsValue.Provider>
  )
}

/** The triggers under a list, through fragments and conditionals, as select options. */
function triggersOf(children: React.ReactNode): { value: string; label: React.ReactNode; disabled?: boolean }[] {
  const out: { value: string; label: React.ReactNode; disabled?: boolean }[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean }
    if (child.type === TabsTrigger && props.value !== undefined) out.push({ value: props.value, label: props.children, disabled: props.disabled })
    else if (props.children) out.push(...triggersOf(props.children))
  })
  return out
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** The tab buttons on the desk; on a phone, a select of the same choices. */
function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const phone = usePhone()
  const tabs = React.useContext(TabsValue)
  if (phone && tabs) {
    return (
      <Select value={tabs.value} onValueChange={tabs.setValue}>
        <SelectTrigger data-slot="tabs-list" aria-label={props["aria-label"] ?? "View"} className={cn("min-w-0 *:data-[slot=select-value]:gap-1.5", className)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {triggersOf(props.children).map((t) => (
            <SelectItem key={t.value} value={t.value} disabled={t.disabled}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
