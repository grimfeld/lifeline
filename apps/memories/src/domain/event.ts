import { EVENT_TYPE, isDateStr, nowClock, todayStr, type Document } from "@lifeline/core";

/**
 * Whether an Event has begun (ADR 0137's panel): its start — an all-day
 * Event's first day — is at or before now. Read from the Event's fields
 * through Core's type id, never through Calendar.
 */
export function eventBegun(doc: Document, now: Date = new Date()): boolean {
  if (doc.type !== EVENT_TYPE || !isDateStr(doc.date)) return false;
  const today = todayStr(now);
  if (doc.date !== today) return doc.date < today;
  const start = typeof doc.start === "string" && doc.start ? doc.start : null;
  return start === null || start <= nowClock(now);
}

/** What New memory opens with from an Event: its title, its first day, About the Event. */
export function memoryFromEvent(event: Document): { title: string; date: string; about: string[] } {
  return { title: event.title, date: String(event.date), about: [event.id] };
}
