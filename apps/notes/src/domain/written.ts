/**
 * Written Days (CONTEXT.md "Day"): a Day is written when it has words of its
 * own beyond its Template's headings and empty lines. One holding only its
 * Template — or only its daylog block — is not written, just like a date with
 * no Day, so the untouched today the Journal makes on arrival never counts.
 * Every label and mark that says a Day is written asks `isWrittenDay`.
 */

import { isCalendarDay } from "./periods";
import { DAILY } from "./types";

/** The slice of a Document these helpers read. */
type DayLike = { type: string; title: string; body?: string };

/** Lines a Template leaves for the user to fill: headings, rules, and list items, tasks and quotes with nothing in them. */
const SCAFFOLD = [/^#{1,6}(\s|$)/, /^(-{3,}|\*{3,}|_{3,})$/, /^\d+[.)]\s*$/, /^[-*+]\s*(\[[ xX]?\]\s*)?$/, /^>\s*$/];

/** Leading frontmatter — but only when every line in it is a property, so a rule opening the user's own writing is never taken for it. */
const FRONTMATTER = /^---\r?\n(?:(?:[\w-]+:.*|\s+-.*|\s*)\r?\n)*?---(?:\r?\n|$)/;

/** A Day's own words: its body without frontmatter, headings, rules, the daylog block and the lines its Template left empty, one space between lines. */
export function ownWords(body: string): string {
  return body
    .replace(FRONTMATTER, "")
    .replace(/```daylog[\s\S]*?```/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !SCAFFOLD.some((re) => re.test(l)))
    .join(" ");
}

/** Whether a Day is written: it exists and has words of its own. `undefined` (no Day on that date) is not written. */
export function isWrittenDay(day: { body?: string } | undefined): boolean {
  return !!day && ownWords(typeof day.body === "string" ? day.body : "") !== "";
}

/** The dates (YYYY-MM-DD) of the written Days among `notes`; other types are ignored. */
export function writtenDates(notes: readonly DayLike[]): Set<string> {
  const out = new Set<string>();
  for (const n of notes) if (n.type === DAILY && isCalendarDay(n.title) && isWrittenDay(n)) out.add(n.title);
  return out;
}
