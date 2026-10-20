/**
 * The Journal calendar zoomed out (spec #204): a year's months and the list
 * of years, marked by where written Days fall. Everything here reads the set
 * of written dates (`writtenDates`), so a Template-only Day marks nothing.
 */

/** How many years the years list shows at once. */
export const YEARS_PER_PAGE = 12;

const prefixes = (written: Iterable<string>, length: number): Set<string> => new Set([...written].map((d) => d.slice(0, length)));

/** The months (`YYYY-MM`) holding at least one written Day. */
export const writtenMonths = (written: Iterable<string>): Set<string> => prefixes(written, 7);

/** The years (`YYYY`) holding at least one written Day. */
export const writtenYears = (written: Iterable<string>): Set<string> => prefixes(written, 4);

/** The first year the years list runs from: the earliest written Day's, never after this year. */
function firstYear(written: Iterable<string>, thisYear: number): number {
  let first = thisYear;
  for (const d of written) first = Math.min(first, Number(d.slice(0, 4)));
  return first;
}

/**
 * The last year of the page of the years list that holds `year`. Pages are
 * twelve years and end on this year; a year outside the list (before the
 * earliest written one, or after this year) takes the nearest page.
 */
export function yearsPageEnd(year: number, written: Iterable<string>, thisYear: number): number {
  const y = Math.min(Math.max(year, firstYear(written, thisYear)), thisYear);
  return thisYear - Math.floor((thisYear - y) / YEARS_PER_PAGE) * YEARS_PER_PAGE;
}

/**
 * The years list's page ending on `end` (from `yearsPageEnd`): its years,
 * oldest first, from the earliest written Day's year at most, and whether
 * there are pages earlier and later.
 */
export function yearsPage(end: number, written: Iterable<string>, thisYear: number): { years: number[]; earlier: boolean; later: boolean } {
  const first = firstYear(written, thisYear);
  const from = Math.max(first, end - YEARS_PER_PAGE + 1);
  const years = Array.from({ length: Math.max(0, end - from + 1) }, (_, i) => from + i);
  return { years, earlier: from > first, later: end < thisYear };
}
