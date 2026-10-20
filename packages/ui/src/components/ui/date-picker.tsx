import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Calendar } from "./calendar"
import { dateOf, formatDateValue, valueOf, withinSpan, yearSpan } from "./date-value"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

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
  const selected = dateOf(value)
  const span = yearSpan(today, { startYear, endYear, min, max, value })
  const minDate = dateOf(min)
  const maxDate = dateOf(max)
  const todayValue = valueOf(today)
  const canToday = withinSpan(todayValue, min, max)
  const canClear = !required && value !== ""
  return (
    <div data-slot="date-picker-panel" className="flex flex-col">
      <Calendar
        mode="single"
        required
        selected={selected}
        onSelect={(d: Date | undefined) => d && onPick(valueOf(d))}
        defaultMonth={selected ?? (canToday ? today : (minDate ?? maxDate ?? today))}
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
 * A day picked from the kit's calendar, never the browser's: a field-style
 * button showing the day ("Tue 20 Oct 2026") that opens the calendar in a
 * popover. Picking a day closes it and calls `onChange` at once; Escape backs
 * out with nothing changed. Value in and out is the native date input's string
 * — `YYYY-MM-DD`, `""` for none — so nothing stored changes. A `Field` child:
 * it takes the Field's id, description and invalid state.
 */
function DatePicker({
  value,
  onChange,
  min,
  max,
  startYear,
  endYear,
  required,
  disabled,
  placeholder,
  locale,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: Span & {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  /** Shown, muted, when no day is set: "No date" (optional) or "Pick a day" (required). */
  placeholder?: string
  /** The trigger's date format; the browser's locale by default. */
  locale?: string
  className?: string
  id?: string
  "aria-label"?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
}) {
  const [open, setOpen] = React.useState(false)
  const text = formatDateValue(value, locale)
  const pick = (next: string) => {
    setOpen(false)
    if (next !== value) onChange(next)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          data-slot="date-picker"
          data-empty={text ? undefined : ""}
          className={cn(
            "flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-empty:text-muted-foreground md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className,
          )}
        >
          <span className="min-w-0 flex-1 truncate">{text || placeholder || (required ? "Pick a day" : "No date")}</span>
          <CalendarIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        align="start"
        aria-label="Choose a day"
        // Focus goes to the selected day (or today), not the month dropdown, so the
        // arrows move between days at once. Done here rather than by the Calendar's own
        // autoFocus alone: inside a Peek or Dialog, that focus comes before this popover
        // has taken focus over from the Peek, which would pull it back to the trigger.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const content = e.currentTarget as HTMLElement
          content.querySelector<HTMLElement>('[role="gridcell"] button[tabindex="0"]')?.focus()
        }}
        // Escape closes the picker only, not a Peek or Dialog under it.
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.stopPropagation()
        }}
      >
        <DatePickerPanel
          value={value}
          onPick={pick}
          min={min}
          max={max}
          startYear={startYear}
          endYear={endYear}
          required={required}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * An icon-only calendar button that acts on the day picked: jump to a day, mark
 * something done on another day. Picking a day (or Today) calls `onPick` at once
 * and closes the popover; there is nothing to clear. `value` only says which day
 * the calendar opens on and shows as selected. The label is required: the
 * button has no text of its own.
 */
function DatePickerButton({
  value = "",
  onPick,
  min,
  max,
  startYear,
  endYear,
  disabled,
  variant = "outline",
  size = "icon",
  className,
  side,
  align = "end",
  "aria-label": ariaLabel,
}: Omit<Span, "required"> & {
  value?: string
  onPick: (value: string) => void
  disabled?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
  size?: "icon" | "icon-xs" | "icon-sm" | "icon-lg"
  className?: string
  /** Where the popover opens; Radix flips it when it doesn't fit. */
  side?: "top" | "bottom"
  align?: "start" | "center" | "end"
  "aria-label": string
}) {
  const [open, setOpen] = React.useState(false)
  const pick = (next: string) => {
    setOpen(false)
    if (next && next !== value) onPick(next)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className} disabled={disabled} aria-label={ariaLabel}>
          <CalendarIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0"
        side={side}
        align={align}
        aria-label="Choose a day"
        // As in DatePicker: focus the selected day (or today) so the arrows move at once.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const content = e.currentTarget as HTMLElement
          content.querySelector<HTMLElement>('[role="gridcell"] button[tabindex="0"]')?.focus()
        }}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") e.stopPropagation()
        }}
      >
        <DatePickerPanel value={value} onPick={pick} min={min} max={max} startYear={startYear} endYear={endYear} required autoFocus />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker, DatePickerButton, DatePickerPanel }
