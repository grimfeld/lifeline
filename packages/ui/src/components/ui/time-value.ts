/**
 * A Time field's value is the string the native time input gave — `HH:MM`,
 * `""` for none — so nothing stored changes. These read what a person types,
 * show the value in the browser's 12h or 24h clock, and step it by quarters.
 */

const pad = (n: number) => String(n).padStart(2, "0")
const DAY = 24 * 60

/** `HH:MM` for minutes past midnight (wrapping round the day). */
function timeOfMinutes(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

/** Minutes past midnight of an `HH:MM` value; undefined when empty or broken. */
function minutesOf(value: string | undefined): number | undefined {
  const m = value ? /^(\d{2}):(\d{2})$/.exec(value) : null
  if (!m) return undefined
  const [h, min] = [Number(m[1]), Number(m[2])]
  return h < 24 && min < 60 ? h * 60 + min : undefined
}

/**
 * What a person typed, as `HH:MM`: "14:30", "14.30", "1430", "930", "9", "2pm",
 * "2:30 PM", "12am". Minutes stay as typed. `""` for empty text; `null` for
 * text that isn't a time, which the field then reverts.
 */
function parseTimeText(text: string): string | null {
  const t = text
    .toLowerCase()
    .replace(/\s+/g, "") // spaces, and the narrow one Intl puts before AM/PM
    .replace(/([ap])\.?(m?)\.?$/, "$1$2") // "a.m." → "am"
    .replace(/^(\d{1,2})\.(\d{2})/, "$1:$2") // "14.30"
  if (t === "") return ""
  const m = /^(\d{1,2})(?:[:h](\d{2}))?(am?|pm?)?$/.exec(t) ?? /^(\d{1,2})(\d{2})(am?|pm?)?$/.exec(t)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] === undefined ? 0 : Number(m[2])
  const period = m[3]?.[0]
  if (period) {
    if (h < 1 || h > 12) return null
    h = (h % 12) + (period === "p" ? 12 : 0)
  }
  if (h > 23 || min > 59) return null
  return `${pad(h)}:${pad(min)}`
}

/** Whether the locale (the browser's by default) reads the clock in 12 hours. */
function uses12Hours(locale?: string): boolean {
  const cycle = new Intl.DateTimeFormat(locale, { hour: "numeric" }).resolvedOptions().hourCycle
  return cycle === "h11" || cycle === "h12"
}

/** "14:30", or "2:30 PM" where the locale reads a 12h clock; "" for none. */
function formatTimeValue(value: string, locale?: string): string {
  const minutes = minutesOf(value)
  if (minutes === undefined) return ""
  const [h, m] = [Math.floor(minutes / 60), minutes % 60]
  if (!uses12Hours(locale)) return `${pad(h)}:${pad(m)}`
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`
}

/** The next quarter hour from `now` (now itself when on one). */
function nextQuarter(now: Date): string {
  const minutes = now.getHours() * 60 + now.getMinutes() + (now.getSeconds() || now.getMilliseconds() ? 1 : 0)
  return timeOfMinutes(Math.ceil(minutes / 15) * 15)
}

/** The value moved by `by` minutes, round the clock; an empty one starts at the next quarter hour. */
function stepTime(value: string, by: number, now: Date = new Date()): string {
  const minutes = minutesOf(value)
  return minutes === undefined ? nextQuarter(now) : timeOfMinutes(minutes + by)
}

/** The list's rows: every quarter hour of the day, 00:00 to 23:45. */
const QUARTER_HOURS: readonly string[] = Array.from({ length: DAY / 15 }, (_, i) => timeOfMinutes(i * 15))

export { parseTimeText, formatTimeValue, uses12Hours, nextQuarter, stepTime, minutesOf, QUARTER_HOURS }
