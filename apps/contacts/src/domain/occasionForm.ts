import type { Occasion } from "./types";

/** What the Occasion dialog holds while it is open. */
export interface OccasionDraft {
  label: string;
  /** "YYYY-MM-DD", or "MM-DD" while the year is unknown. */
  day: string;
  yearly: boolean;
  /** "I don't know the year": only a yearly Occasion may lack one. */
  noYear: boolean;
}

/** The dialog as it opens: blank and yearly for a new Occasion, else the Occasion as it is. */
export function occasionDraft(editing: Occasion | "new"): OccasionDraft {
  if (editing === "new") return { label: "", day: "", yearly: true, noYear: false };
  return { label: editing.label, day: editing.day, yearly: editing.yearly, noYear: editing.day.length === 5 };
}

/** Whether the dialog asks for a month and a day only: a yearly Occasion whose year is unknown. */
export const asksMonthDay = (d: Pick<OccasionDraft, "yearly" | "noYear">) => d.yearly && d.noYear;

/** What the dialog saves: a yearly day with no year keeps only "MM-DD"; any other keeps the day picked. */
export function occasionInput(d: OccasionDraft): Pick<Occasion, "label" | "day" | "yearly"> {
  return { label: d.label, day: asksMonthDay(d) ? d.day.slice(-5) : d.day, yearly: d.yearly };
}

/** The day after "I don't know the year" is ticked or unticked: without a year, the month and day stay; with one again, the day is to pick. */
export const dayWhenNoYear = (day: string, noYear: boolean) => (noYear ? day.slice(-5) : "");

/** The date picker's value: a full day, or nothing while only a month and day are known. */
export const pickerDay = (day: string) => (day.length === 10 ? day : "");

/** How many days a month ("01"…"12") has at most: 29 for February, so 29 February can be given; 31 before a month is picked. */
export const daysIn = (month: string) => (month ? new Date(Date.UTC(2000, Number(month), 0)).getUTCDate() : 31);

/** A month and a day of it as "MM-DD"; a day past the month's end (31, then April) becomes its last day. */
export function monthDay(month: string, day: string): string {
  const last = daysIn(month);
  return `${month}-${day && Number(day) > last ? String(last) : day}`;
}
