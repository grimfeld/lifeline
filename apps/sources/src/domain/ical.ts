import ICAL from "ical.js";
import type { DateStr } from "@lifeline/core";

/** One occurrence of a subscribed event on one day (multi-day events yield one per day). */
export interface IcalOccurrence {
  uid: string;
  title: string;
  date: DateStr;
  /** "HH:MM" local, or null when all-day. */
  start: string | null;
  end: string | null;
  location?: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function dateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function timeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addDays(d: DateStr, n: number): DateStr {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  const dt = new Date(y, m - 1, day + n);
  return dateStr(dt);
}

/**
 * Expand an iCalendar body into per-day occurrences within [rangeStart, rangeEnd]
 * (inclusive DateStr). RRULE/RDATE/EXDATE and per-instance overrides are handled by
 * ical.js; times are converted to the local zone; all-day events keep their dates.
 */
/** Per recurring event: at most this many occurrences in a range… */
const MAX_SHOWN = 5000;
/** …and this many stepped over before it (a century of a daily event). */
const MAX_SKIPPED = 50_000;

export function expandIcal(body: string, rangeStart: DateStr, rangeEnd: DateStr): IcalOccurrence[] {
  const jcal = ICAL.parse(body);
  const comp = new ICAL.Component(jcal);
  const vevents = comp.getAllSubcomponents("vevent");
  const rangeStartT = ICAL.Time.fromDateString(rangeStart);
  const rangeEndT = ICAL.Time.fromDateString(addDays(rangeEnd, 1)); // exclusive
  const out: IcalOccurrence[] = [];

  // Group by UID: master + overrides (RECURRENCE-ID) — ical.js's Event handles that with `exceptions`.
  const byUid = new Map<string, { master?: ICAL.Component; exceptions: ICAL.Component[] }>();
  for (const v of vevents) {
    const uid = v.getFirstPropertyValue("uid") as string | null;
    if (!uid) continue;
    const g = byUid.get(uid) ?? { exceptions: [] };
    if (v.getFirstProperty("recurrence-id")) g.exceptions.push(v);
    else g.master = v;
    byUid.set(uid, g);
  }

  const push = (uid: string, title: string, start: ICAL.Time, end: ICAL.Time, location: string | undefined) => {
    if (start.isDate) {
      // All-day: DTEND is exclusive; iterate days
      const first = start.toString().slice(0, 10) as DateStr;
      let last = end ? (end.toString().slice(0, 10) as DateStr) : first;
      if (last > first) last = addDays(last, -1);
      for (let d = first; d <= last; d = addDays(d, 1)) {
        if (d >= rangeStart && d <= rangeEnd) out.push({ uid, title, date: d, start: null, end: null, location });
      }
      return;
    }
    const s = start.toJSDate();
    const e = end ? end.toJSDate() : new Date(s.getTime() + 60 * 60 * 1000);
    const sd = dateStr(s);
    const ed = dateStr(e);
    // Same-day (or ends at midnight next day): one item; otherwise one per day.
    const endsAtMidnightNext = ed === addDays(sd, 1) && e.getHours() === 0 && e.getMinutes() === 0;
    if (ed === sd || endsAtMidnightNext) {
      if (sd >= rangeStart && sd <= rangeEnd) out.push({ uid, title, date: sd, start: timeStr(s), end: endsAtMidnightNext ? "24:00" : timeStr(e), location });
      return;
    }
    for (let d = sd; d <= ed; d = addDays(d, 1)) {
      if (d < rangeStart || d > rangeEnd) continue;
      out.push({ uid, title, date: d, start: d === sd ? timeStr(s) : "00:00", end: d === ed ? timeStr(e) : "24:00", location });
    }
  };

  for (const [uid, g] of byUid) {
    if (!g.master) {
      // Orphan overrides: show them as-is.
      for (const x of g.exceptions) {
        const ev = new ICAL.Event(x);
        push(uid, ev.summary ?? "(untitled)", ev.startDate, ev.endDate, ev.location ?? undefined);
      }
      continue;
    }
    const ev = new ICAL.Event(g.master, { exceptions: g.exceptions });
    if (!ev.isRecurring()) {
      if (ev.endDate.compare(rangeStartT) < 0 || ev.startDate.compare(rangeEndT) >= 0) continue;
      push(uid, ev.summary ?? "(untitled)", ev.startDate, ev.endDate, ev.location ?? undefined);
      continue;
    }
    const it = ev.iterator();
    let next: ICAL.Time | null;
    // Two guards: occurrences shown, and occurrences stepped over before the
    // range — a daily event from 2010 has thousands of those and must still show.
    let shown = 0;
    let skipped = 0;
    while ((next = it.next()) && shown < MAX_SHOWN && skipped < MAX_SKIPPED) {
      if (next.compare(rangeEndT) >= 0) break;
      const occ = ev.getOccurrenceDetails(next);
      if (occ.endDate.compare(rangeStartT) < 0) {
        skipped++;
        continue;
      }
      shown++;
      const item = occ.item;
      push(uid, item.summary ?? "(untitled)", occ.startDate, occ.endDate, item.location ?? undefined);
    }
  }
  return out;
}
