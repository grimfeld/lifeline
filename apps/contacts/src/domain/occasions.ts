import { addDays, diffDays, daysInMonth, fromParts, normalizeTags, type DateStr, type TimedItem } from "@lifeline/core";
import type { Occasion } from "./types";

export const APP_ID = "contacts";

/** What the markers need of a Person. */
export interface PersonOccasions {
  id: string;
  title: string;
  tags?: string[];
  occasions?: Occasion[];
}

/** The one label the App understands: it gives an age. */
export const isBirthday = (o: Pick<Occasion, "label">) => o.label.trim().toLowerCase() === "birthday";

/** "YYYY-MM-DD", or "MM-DD" for a day whose year is unknown. */
const DAY = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/;

/** The year, month and day of an Occasion's `day`; year null when unknown; null for text that is no day. */
function split(day: string): { year: number | null; month: number; dom: number } | null {
  const m = DAY.exec(day);
  if (!m) return null;
  const year = m[1] === undefined ? null : Number(m[1]);
  const [month, dom] = [Number(m[2]), Number(m[3])];
  // Without a year, February 29 is allowed (a yearly day).
  if (month < 1 || month > 12 || dom < 1 || dom > daysInMonth(year ?? 2000, month)) return null;
  return { year, month, dom };
}

/** The year an Occasion's day names; null when unknown, or when the text is no day. */
const yearOf = (day: string): number | null => split(day)?.year ?? null;

/**
 * An Occasion's day in words, in the reader's own order: "03-04" reads as "4
 * March", "1961-03-04" as "4 March 1961". A yearless day is read in 2000, a
 * leap year, so 29 February reads too. Text that is no day reads as it is.
 */
export function describeDay(day: string, locale?: string): string {
  const d = split(day);
  if (!d) return day;
  const when = new Date(Date.UTC(d.year ?? 2000, d.month - 1, d.dom));
  return when.toLocaleDateString(locale, { day: "numeric", month: "long", year: d.year === null ? undefined : "numeric", timeZone: "UTC" });
}

/**
 * The day a yearly Occasion falls on in a year. February 29 falls on February
 * 28 in a year that is not a leap year, so the day is never skipped and never
 * late.
 */
export function occasionDateIn(day: string, year: number): DateStr {
  const d = split(day);
  if (!d) return "";
  return fromParts(year, d.month, Math.min(d.dom, daysInMonth(year, d.month)));
}

/** Why an Occasion may not be saved, in words; null when it may. */
export function occasionProblem(o: Pick<Occasion, "label" | "day" | "yearly">): string | null {
  if (!o.label.trim()) return "An Occasion needs a label";
  const d = split(o.day);
  if (!d) return "Pick a real day";
  if (!o.yearly && d.year === null) return "A once Occasion needs its year";
  return null;
}

/** The stored `occasions`, with anything that is no Occasion dropped. */
export function normalizeOccasions(raw: unknown): Occasion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (o): o is Occasion => !!o && typeof o.id === "string" && typeof o.label === "string" && typeof o.day === "string" && typeof o.yearly === "boolean",
  );
}

/** The age a Birthday reaches in a year; null with no birth year (or a year not yet reached). */
function ageIn(o: Occasion, year: number): number | null {
  const born = yearOf(o.day);
  return born === null || year < born ? null : year - born;
}

/**
 * Their age on a day, from their first Birthday with a known year: the years
 * since, until the day comes round. null when it can't be known.
 */
export function ageOf(occasions: readonly Occasion[], today: DateStr): number | null {
  const y = Number(today.slice(0, 4));
  for (const o of occasions) {
    if (!isBirthday(o) || !o.yearly) continue;
    const reached = ageIn(o, y);
    if (reached === null) continue;
    if (occasionDateIn(o.day, y) <= today) return reached;
    return reached > 0 ? reached - 1 : null;
  }
  return null;
}

/** The marker's words: "🎂 Anne · 65", "🎂 Anne" with no age, "⚑ Marc · Surgery". */
function titleOf(person: PersonOccasions, o: Occasion, age: number | null): string {
  if (isBirthday(o)) return `🎂 ${person.title}${age === null ? "" : ` · ${age}`}`;
  return `⚑ ${person.title} · ${o.label.trim()}`;
}

interface Occurrence {
  person: PersonOccasions;
  occasion: Occasion;
  date: DateStr;
  /** The age a yearly Birthday reaches on `date`; null otherwise or with no birth year. */
  age: number | null;
}

/** The years from `from` through `to`, both included; none when `to` is earlier (a negative length is none). */
const yearsBetween = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * Where one Occasion may fall between two years: a once one on its own day, a
 * yearly one on its day each year from the year it began (when known). Nothing
 * for an Occasion that may not be saved.
 */
function occurrencesOf(person: PersonOccasions, o: Occasion, y0: number, y1: number): Occurrence[] {
  if (occasionProblem(o)) return [];
  if (!o.yearly) return [{ person, occasion: o, date: o.day, age: null }];
  const born = yearOf(o.day);
  const birthday = isBirthday(o);
  return yearsBetween(Math.max(y0, born ?? y0), y1).map((y) => ({ person, occasion: o, date: occasionDateIn(o.day, y), age: birthday ? ageIn(o, y) : null }));
}

/** Every Occasion falling in a range, a yearly one on its day each year (from the year it began), a once one on its own day. */
function occurrencesIn(people: readonly PersonOccasions[], range: { start: DateStr; end: DateStr }): Occurrence[] {
  const [y0, y1] = [Number(range.start.slice(0, 4)), Number(range.end.slice(0, 4))];
  // Whatever is stored: a Base or an old row may hold anything under the key.
  return people
    .flatMap((person) => normalizeOccasions(person.occasions).flatMap((o) => occurrencesOf(person, o, y0, y1)))
    .filter(({ date }) => date >= range.start && date <= range.end);
}

/**
 * Occasions as all-day markers in a range: a yearly one on its day each year
 * (from the year it began, when that is known), a once one on its own day.
 * Birthdays carry the age they reach. Not Events, and not Deadlines.
 */
export function occasionMarkersIn(people: readonly PersonOccasions[], range: { start: DateStr; end: DateStr }): TimedItem[] {
  return occurrencesIn(people, range)
    .map(({ person, occasion: o, date, age }): TimedItem => {
      const id = `${person.id}:${o.id}@${date}`;
      return {
        key: `${APP_ID}/${id}`,
        appId: APP_ID,
        itemId: id,
        title: titleOf(person, o, age),
        date,
        start: null,
        end: null,
        tags: normalizeTags(person.tags ?? []),
        marker: true,
        occasion: true,
        docId: person.id,
        ...(age === null ? {} : { age }),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

/** One line of Upcoming: an Occasion coming up. */
export interface UpcomingOccasion {
  personId: string;
  /** The Occasion's id on its Person: with `personId` and `date`, one row's key. */
  occasionId: string;
  name: string;
  label: string;
  date: DateStr;
  /** Whole days from the start of the window; 0 is that day itself. */
  inDays: number;
  /** The age a Birthday reaches that day; null for any other Occasion or a Birthday with no year. */
  age: number | null;
}

/**
 * The Upcoming Report: the Occasions from `from` through `days` days later
 * (both ends included), soonest first, ties by name then label. Pure, so the
 * MCP `people_upcoming` tool can reuse it.
 */
export function upcomingOccasions(people: readonly PersonOccasions[], from: DateStr, days: number): UpcomingOccasion[] {
  if (!(days >= 0)) return [];
  const end = addDays(from, Math.floor(days));
  return occurrencesIn(people, { start: from, end })
    .map(({ person, occasion, date, age }) => ({
      personId: person.id,
      occasionId: occasion.id,
      name: person.title,
      label: occasion.label.trim(),
      date,
      inDays: diffDays(from, date),
      age,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.label.localeCompare(b.label));
}

/** How soon an Upcoming Occasion is: "today", "tomorrow", "in 5 days". */
export const whenOf = (inDays: number) => (inDays === 0 ? "today" : inDays === 1 ? "tomorrow" : `in ${inDays} days`);

/** The Person id inside a marker's item id. */
export const personOfMarker = (itemId: string) => itemId.split(":")[0] ?? "";
