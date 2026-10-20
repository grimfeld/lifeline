/**
 * A Date picker's value is the string the native date input gave — `YYYY-MM-DD`,
 * `""` for none — so nothing stored changes. The calendar wants a `Date`; these
 * convert between the two in local time (never UTC: `new Date("2026-10-20")`
 * is midnight in London, the evening before in New York).
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** The stored day as a local-midnight Date; undefined when empty or not a real day. */
function dateOf(value: string | undefined): Date | undefined {
  const m = value ? DAY.exec(value) : null
  if (!m) return undefined
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
  const date = new Date(2000, 0, 1)
  date.setFullYear(y, mo, d)
  return date.getFullYear() === y && date.getMonth() === mo && date.getDate() === d ? date : undefined
}

/** A picked Date as the stored string. */
function valueOf(date: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0")
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "Tue 20 Oct 2026" — the day in the browser's locale (or `locale`); "" for none. */
function formatDateValue(value: string, locale?: string): string {
  const date = dateOf(value)
  if (!date) return ""
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .format(date)
    .replace(/,/g, "")
}

/**
 * The years the header's dropdown offers: from `startYear` (1900) to ten years
 * past today, widened to take in `min`, `max` and the value itself so neither a
 * bound nor what is stored is ever out of reach.
 */
function yearSpan(
  today: Date,
  { startYear = 1900, endYear, min, max, value }: { startYear?: number; endYear?: number; min?: string; max?: string; value?: string } = {},
): { from: number; to: number } {
  const years = [min, max, value].map((v) => dateOf(v)?.getFullYear()).filter((y): y is number => y !== undefined)
  return {
    from: Math.min(startYear, ...years),
    to: Math.max(endYear ?? today.getFullYear() + 10, ...years),
  }
}

/** Whether a day lies within `min`/`max` (both inclusive, either open). The strings sort as days do. */
function withinSpan(value: string, min: string | undefined, max: string | undefined): boolean {
  return (!min || value >= min) && (!max || value <= max)
}

export { dateOf, valueOf, formatDateValue, yearSpan, withinSpan }
