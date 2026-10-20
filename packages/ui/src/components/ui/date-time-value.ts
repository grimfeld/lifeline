/**
 * A Date and time field's value is the string the native `datetime-local`
 * input gave — local `YYYY-MM-DDTHH:MM`, `""` for none — so nothing stored
 * changes. These split and rebuild it.
 */

const pad = (n: number) => String(n).padStart(2, "0")

/** The day and the time a value holds; `""` for each part missing. */
function splitMoment(value: string): { day: string; time: string } {
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(value)
  return { day: m?.[1] ?? "", time: m?.[2] ?? "" }
}

/** A Date as a `datetime-local` value, in local time. */
function momentOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * The value once `day` is picked: the time already set is kept; with no time
 * yet, the time now fills in ("it happened today, just now" is one tap). On
 * `max`'s day the time never goes past it, so a field capped at now is never
 * handed a moment it would refuse. A cleared day holds nothing.
 */
function withDay(day: string, time: string, { now, max }: { now: Date; max?: string }): string {
  if (!day) return ""
  const moment = `${day}T${time || `${pad(now.getHours())}:${pad(now.getMinutes())}`}`
  return max && moment.slice(0, 10) === max.slice(0, 10) && moment > max.slice(0, 16) ? max.slice(0, 16) : moment
}

export { splitMoment, momentOf, withDay }
