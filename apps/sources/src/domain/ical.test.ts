import { describe, expect, it } from "vitest";
import { expandIcal } from "./ical";

// Floating (zone-less) times: they read as local wall-clock time, so the
// expected days hold in any time zone. With UTC times the 10:00Z standup lands
// on the next local day at UTC+14, and 09:00Z on the previous one west of UTC-9.
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:one
SUMMARY:Standup
DTSTART:20260817T090000
DTEND:20260817T091500
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
BEGIN:VEVENT
UID:one
RECURRENCE-ID:20260819T090000
SUMMARY:Standup (moved)
DTSTART:20260819T100000
DTEND:20260819T101500
END:VEVENT
BEGIN:VEVENT
UID:two
SUMMARY:Holiday
DTSTART;VALUE=DATE:20260820
DTEND;VALUE=DATE:20260822
END:VEVENT
END:VCALENDAR`;

describe("expandIcal", () => {
  it("expands RRULE with an override and all-day multi-day events", () => {
    const occ = expandIcal(ICS, "2026-08-18", "2026-08-21");
    const standups = occ.filter((o) => o.uid === "one");
    expect(standups.map((o) => o.date)).toEqual(["2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21"]);
    expect(standups.find((o) => o.date === "2026-08-19")?.title).toBe("Standup (moved)");
    const hol = occ.filter((o) => o.uid === "two");
    expect(hol.map((o) => o.date)).toEqual(["2026-08-20", "2026-08-21"]);
    expect(hol[0]).toMatchObject({ start: null, end: null, title: "Holiday" });
  });
  it("still shows a long-running recurrence (more than 5000 occurrences before the range)", () => {
    const daily = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:old
SUMMARY:Pills
DTSTART:20000101T080000Z
DTEND:20000101T081500Z
RRULE:FREQ=DAILY
END:VEVENT
END:VCALENDAR`;
    expect(expandIcal(daily, "2026-08-18", "2026-08-20").map((o) => o.date)).toEqual(["2026-08-18", "2026-08-19", "2026-08-20"]);
  });
  it("respects range", () => {
    expect(expandIcal(ICS, "2026-09-01", "2026-09-30")).toEqual([]);
  });
});
