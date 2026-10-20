/**
 * A Date and time field's value is the string the native `datetime-local`
 * input gave — local `YYYY-MM-DDTHH:MM`, `""` for none — so nothing stored
 * changes. These split and rebuild it; the day half is a Date picker's value
 * (`date-value.ts`).
 */

import { dayValueOf, pad } from "./date-value"

/** The day and the time a value holds; `""` for each part missing. */
function splitMoment(value: string): { day: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value)
  return { day: m?.[1] ?? "", time: m?.[2] ?? "" }
}

/** A Date's time of day as `HH:MM`, in local time. */
function timeValueOf(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A Date as a `datetime-local` value, in local time. */
function momentOf(date: Date): string {
  return `${dayValueOf(date)}T${timeValueOf(date)}`
}

/**
 * The value once `day` is picked: the time already set is kept; with no time
 * yet, the time now fills in ("it happened today, just now" is one tap). On
 * `max`'s day the time never goes past it, so a field capped at now is never
 * handed a moment it would refuse. A cleared day holds nothing.
 */
function withDay(day: string, time: string, { now, max }: { now: Date; max?: string }): string {
  if (!day) return ""
  const moment = `${day}T${time || timeValueOf(now)}`
  return max && moment.slice(0, 10) === max.slice(0, 10) && moment > max.slice(0, 16) ? max.slice(0, 16) : moment
}

export { splitMoment, momentOf, withDay }
