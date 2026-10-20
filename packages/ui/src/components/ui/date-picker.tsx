import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { dateOfDay, dayValueOf, formatDateValue, withinSpan, yearSpan } from "./date-value"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

/** The days a date control offers, shared by the Date picker and the fields built on it. */
type Span = {
  /** The earliest day that may be picked (`YYYY-MM-DD`); days before it are disabled. */
  min?: string
  /** The latest day that may be picked. */
  max?: string
  /** First year in the header's dropdown (1900). Widen it for historical dates. */
  startYear?: number
  /** Last year in the dropdown (ten years from now). */
  endYear?: number
  /** A required day can't be cleared. */
  required?: boolean
}

/**
 * Put focus on the calendar's selected day (or today) inside `container`, so the
 * arrows move between days at once. Called from a popover's or dialog's
 * `onOpenAutoFocus` (after `preventDefault()`) rather than left to the Calendar's
 * own autoFocus: inside a Peek or Dialog, that focus comes before the popover has
 * taken focus over, and the surrounding focus trap pulls it back.
 */
function focusCalendarDay(container: HTMLElement) {
  container.querySelector<HTMLElement>('[role="gridcell"] button[tabindex="0"]')?.focus()
}

/**
 * What the Date picker's popover holds: the month with dropdowns for month and
 * year, then Today (when today may be picked) and Clear (when the day is
 * optional and set). Picking — a day, Today or Clear — hands the new value
 * (`YYYY-MM-DD`, `""` for cleared) to `onPick`.
 */
function DatePickerPanel({
  value,
  onPick,
  min,
  max,
  startYear,
  endYear,
  required,
  today = new Date(),
  autoFocus,
}: Span & {
  value: string
  onPick: (value: string) => void
  /** Today, for tests; the clock otherwise. */
  today?: Date
  /** Put focus on the selected day (or today), so the arrow keys move between days. */
  autoFocus?: boolean
}) {
  const selected = dateOfDay(value)
  const span = yearSpan(today, { startYear, endYear, min, max, value })
  const minDate = dateOfDay(min)
  const maxDate = dateOfDay(max)
  const todayValue = dayValueOf(today)
  const canToday = withinSpan(todayValue, min, max)
  const canClear = !required && value !== ""
  return (
    <div data-slot="date-picker-panel" className="flex flex-col">
      <Calendar
        mode="single"
        required
        selected={selected}
        onSelect={(d: Date | undefined) => d && onPick(dayValueOf(d))}
        // The selected day's month; else today's, brought within min and max, so an
        // empty "To" opens on its "From" when that is ahead.
        defaultMonth={selected ?? (minDate && today < minDate ? minDate : maxDate && today > maxDate ? maxDate : today)}
        today={today}
        captionLayout="dropdown"
        startMonth={new Date(span.from, 0, 1)}
        endMonth={new Date(span.to, 11, 1)}
        disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
        autoFocus={autoFocus}
      />
      {(canToday || canClear) && (
        <div className="flex items-center justify-between gap-2 border-t p-2">
          {canToday ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onPick(todayValue)}>
              Today
            </Button>
          ) : (
            <span />
          )}
          {canClear && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onPick("")}>
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * A trigger and the Date picker's panel in a popover — what DatePicker and
 * DatePickerButton share. Picking closes it; `onPick` hears the value only when
 * it differs from `value` (and, when `required`, isn't empty). Escape closes the
 * popover only, not a Peek or Dialog under it.
 */
function DatePickerPopover({
  value,
  onPick,
  trigger,
  side,
  align = "start",
  ...span
}: Span & {
  value: string
  onPick: (value: string) => void
  trigger: React.ReactElement
  side?: "top" | "bottom"
  align?: "start" | "center" | "end"
}) {
  const [open, setOpen] = React.useState(false)
  const pick = (next: string) => {
    setOpen(false)
    if (next !== value && (next || !span.required)) onPick(next)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        side={side}
        align={align}
        aria-label="Choose a day"
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          focusCalendarDay(e.currentTarget as HTMLElement)
        }}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.stopPropagation()
        }}
      >
        <DatePickerPanel value={value} onPick={pick} {...span} autoFocus />
      </PopoverContent>
    </Popover>
  )
}

/**
 * A day picked from the kit's calendar, never the browser's: a field-style
 * button showing the day ("Tue 20 Oct 2026") that opens the calendar in a
 * popover. Picking a day closes it and calls `onChange` at once; Escape backs
 * out with nothing changed. Value in and out is the native date input's string
 * — `YYYY-MM-DD`, `""` for none — so nothing stored changes. A `Field` child:
 * it takes the Field's id, description and invalid state. Given an
 * `aria-label`, the button is named by it and the day it shows ("From, Tue 20
 * Oct 2026"), so a screen reader hears the day too.
 */
function DatePicker({
  value,
  onChange,
  required,
  disabled,
  placeholder,
  locale,
  size = "default",
  className,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...span
}: Span & {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Shown, muted, when no day is set: "No date" (optional) or "Pick a day" (required). */
  placeholder?: string
  /** The trigger's date format; the browser's locale by default. */
  locale?: string
  /** `sm` sits beside small controls (`SelectTrigger size="sm"`, `Button size="sm"`). */
  size?: "default" | "sm"
  className?: string
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
}) {
  const text = formatDateValue(value, locale)
  const none = required ? "Pick a day" : "No date"
  const shown = text || placeholder || none
  // A placeholder that only repeats the label ("To") says nothing after it.
  const named = text || (placeholder && placeholder !== ariaLabel ? placeholder : none)
  return (
    <DatePickerPopover
      value={value}
      onPick={onChange}
      required={required}
      {...span}
      trigger={
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel ? `${ariaLabel}, ${named}` : undefined}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          data-slot="date-picker"
          data-size={size}
          data-empty={text ? undefined : ""}
          className={cn(
            "flex w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-empty:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:text-xs md:text-sm md:data-[size=sm]:text-xs dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{shown}</span>
          <CalendarIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
      }
    />
  )
}

/**
 * An icon-only calendar button that acts on the day picked: jump to a day, mark
 * something done on another day. Picking a day (or Today) calls `onPick` at once
 * and closes the popover; there is nothing to clear. `value` only says which day
 * the calendar opens on and shows as selected; the button is named by its label
 * and that day ("Jump to date, Tue 20 Oct 2026"). The label is required: the
 * button has no text of its own.
 */
function DatePickerButton({
  value = "",
  onPick,
  disabled,
  variant = "outline",
  size = "icon",
  locale,
  className,
  side,
  align = "end",
  "aria-label": ariaLabel,
  ...span
}: Omit<Span, "required"> & {
  value?: string
  onPick: (value: string) => void
  disabled?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  /** The date's format in the button's name; the browser's locale by default. */
  locale?: string
  className?: string
  /** Where the popover opens; Radix flips it when it doesn't fit. */
  side?: "top" | "bottom"
  align?: "start" | "center" | "end"
  "aria-label": string
}) {
  const text = formatDateValue(value, locale)
  return (
    <DatePickerPopover
      value={value}
      onPick={onPick}
      required
      side={side}
      align={align}
      {...span}
      trigger={
        <Button type="button" variant={variant} size={size} className={className} disabled={disabled} aria-label={text ? `${ariaLabel}, ${text}` : ariaLabel}>
          <CalendarIcon aria-hidden />
        </Button>
      }
    />
  )
}

export { DatePicker, DatePickerButton, DatePickerPanel, focusCalendarDay }
export type { Span as DateSpan }
