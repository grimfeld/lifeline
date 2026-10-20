import * as React from "react"

import { cn } from "../../lib/utils"
import { DatePicker, type DateSpan } from "./date-picker"
import { momentOf, splitMoment, withDay } from "./date-time-value"
import { TimeField } from "./time-field"

/**
 * A moment picked as two controls side by side: the day from the kit's Date
 * picker, the time typed or picked in the kit's Time field. Value in and out is the
 * string `datetime-local` gave — local `YYYY-MM-DDTHH:MM`, `""` for none — so
 * nothing stored changes. Picking a day with no time yet fills in the time now
 * (never past `max`); an existing time is kept. `onChange` says which control
 * moved it; both report a finished choice (a picked day, a time picked or
 * read once typing is done), so a field written in place writes it at once. A `Field` child: its id, description and
 * invalid state go to the day.
 */
function DateTimeField({
  value,
  onChange,
  min,
  max,
  required,
  startYear,
  endYear,
  disabled,
  placeholder,
  className,
  id,
  timeLabel = "Time",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: Omit<DateSpan, "min" | "max"> & {
  value: string
  onChange: (value: string, from: "day" | "time") => void
  /** The earliest moment (`YYYY-MM-DDTHH:MM`); days before its day are disabled. */
  min?: string
  /** The latest moment; days after its day are disabled, and a filled-in time stays at or before it. */
  max?: string
  disabled?: boolean
  placeholder?: string
  className?: string
  id?: string
  /** The Time field's accessible name ("Time"). */
  timeLabel?: string
  "aria-label"?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
}) {
  const { day, time } = splitMoment(value)
  // A time the value can't hold yet — typed before any day is picked, or cleared
  // half-way through typing — is held here until it can.
  const [typed, setTyped] = React.useState<string | null>(null)
  React.useEffect(() => setTyped(null), [value])
  const shownTime = typed ?? time
  const maxDay = max?.slice(0, 10)
  const minDay = min?.slice(0, 10)
  return (
    <div data-slot="date-time-field" className={cn("flex min-w-0 items-center gap-2", className)}>
      <DatePicker
        id={id}
        value={day}
        onChange={(next) => {
          setTyped(null)
          onChange(withDay(next, shownTime, { now: new Date(), max }), "day")
        }}
        min={minDay}
        max={maxDay}
        required={required}
        startYear={startYear}
        endYear={endYear}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        className="min-w-0 flex-1"
      />
      <TimeField
        aria-label={timeLabel}
        disabled={disabled}
        required={required && !!day}
        value={shownTime}
        onChange={(next) => {
          if (!day || !next) return setTyped(next)
          setTyped(null)
          onChange(`${day}T${next}`, "time")
        }}
        className="w-32 shrink-0"
      />
    </div>
  )
}

/** Now as a Date and time field's value. */
function nowMoment(): string {
  return momentOf(new Date())
}

export { DateTimeField, nowMoment }
