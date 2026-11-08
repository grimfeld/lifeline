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

const FULL = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHORT = /^(\d{2})-(\d{2})$/;

/** The year, month and day of an Occasion's `day`; year null when unknown; null for text that is no day. */
function split(day: string): { year: number | null; month: number; dom: number } | null {
  const full = FULL.exec(day);
  const short = full ? null : SHORT.exec(day);
  if (!full && !short) return null;
  const [year, month, dom] = full ? [Number(full[1]), Number(full[2]), Number(full[3])] : [null, Number(short![1]), Number(short![2])];
  if (!(month >= 1 && month <= 12) || !(dom >= 1)) return null;
  // Without a year, February 29 is allowed (a yearly day).
  if (dom > daysInMonth(year ?? 2000, month)) return null;
  return { year, month, dom };
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
  const born = split(o.day)?.year;
  return born == null || year < born ? null : year - born;
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

/** Every Occasion falling in a range, a yearly one on its day each year (from the year it began), a once one on its own day. */
function occurrencesIn(people: readonly PersonOccasions[], range: { start: DateStr; end: DateStr }): Occurrence[] {
  const out: Occurrence[] = [];
  const [y0, y1] = [Number(range.start.slice(0, 4)), Number(range.end.slice(0, 4))];
  for (const person of people) {
    for (const o of person.occasions ?? []) {
      if (occasionProblem(o)) continue;
      const born = split(o.day)?.year ?? null;
      const years = o.yearly ? Array.from({ length: Math.max(0, y1 - y0 + 1) }, (_, i) => y0 + i) : born === null ? [] : [born];
      for (const y of years) {
        if (o.yearly && born !== null && y < born) continue;
        const date = o.yearly ? occasionDateIn(o.day, y) : o.day;
        if (date < range.start || date > range.end) continue;
        out.push({ person, occasion: o, date, age: isBirthday(o) && o.yearly ? ageIn(o, y) : null });
      }
    }
  }
  return out;
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
      name: person.title,
      label: occasion.label.trim(),
      date,
      inDays: diffDays(from, date),
      age,
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.label.localeCompare(b.label));
}

/** The Person id inside a marker's item id. */
export const personOfMarker = (itemId: string) => itemId.split(":")[0] ?? "";
