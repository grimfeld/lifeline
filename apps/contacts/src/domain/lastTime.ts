import { diffDays, type DateStr, type Document, type TimelineEntry } from "@lifeline/core";
import { labelOf } from "./exchanges";

/**
 * Last time (CONTEXT.md, ADR 0131): the newest thing someone told me, held on
 * their page above the Timeline. The newest Exchange (its body) or Event (its
 * Notes) in the Person's reach, a Household's included, that has text: by day,
 * then by last changed. A day to come is not "last time". Derived, never stored.
 */
export interface LastTime {
  id: string;
  /** "Call", "Video call", "Message", "Letter" or "Event". */
  label: string;
  /** The Event's title; empty for an Exchange (its kind says it all). */
  title: string;
  day: DateStr;
  /** Days before today. */
  daysAgo: number;
  text: string;
}

const EXCHANGE = "contacts_exchange";
const EVENT = "event";

/** What a Document has to say: an Exchange's body, an Event's Notes; empty for anything else. */
function textOf(d: Document): string {
  const v = d.type === EXCHANGE ? d.body : d.type === EVENT ? d.notes : "";
  return typeof v === "string" ? v.trim() : "";
}

/** `entries` are the Person's timeline (it already holds what reaches them through a Household); `docOf` reads a Document by id. */
export function lastTimeOf(entries: readonly TimelineEntry[], docOf: (id: string) => Document | undefined, today: DateStr): LastTime | null {
  let best: { d: Document; day: string; text: string } | null = null;
  for (const e of entries) {
    const d = docOf(e.sourceId);
    if (!d || (d.type !== EXCHANGE && d.type !== EVENT)) continue;
    const day = typeof d.date === "string" ? d.date : "";
    const text = textOf(d);
    if (!text || !day || day > today) continue;
    const newer = !best || day > best.day || (day === best.day && (String(d.updatedAt ?? "") > String(best.d.updatedAt ?? "") || (d.updatedAt === best.d.updatedAt && d.id > best.d.id)));
    if (newer) best = { d, day, text };
  }
  if (!best) return null;
  const { d, day, text } = best;
  const isExchange = d.type === EXCHANGE;
  return { id: d.id, label: isExchange ? labelOf(d.kind) : "Event", title: isExchange ? "" : d.title, day: day as DateStr, daysAgo: diffDays(day as DateStr, today), text };
}

/** "today", "yesterday", "5 days ago", "2 weeks ago", "3 months ago", "1 year ago". */
export function agoOf(days: number): string {
  const n = (k: number, unit: string) => `${k} ${unit}${k === 1 ? "" : "s"} ago`;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return n(days, "day");
  if (days < 30) return n(Math.floor(days / 7), "week");
  if (days < 365) return n(Math.floor(days / 30), "month");
  return n(Math.floor(days / 365), "year");
}
