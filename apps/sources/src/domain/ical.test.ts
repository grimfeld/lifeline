import { describe, expect, it } from "vitest";
import { expandIcal } from "./ical";

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//EN
BEGIN:VEVENT
UID:one
SUMMARY:Standup
DTSTART:20260817T090000Z
DTEND:20260817T091500Z
RRULE:FREQ=DAILY;COUNT=5
END:VEVENT
BEGIN:VEVENT
UID:one
RECURRENCE-ID:20260819T090000Z
SUMMARY:Standup (moved)
DTSTART:20260819T100000Z
DTEND:20260819T101500Z
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
  it("respects range", () => {
    expect(expandIcal(ICS, "2026-09-01", "2026-09-30")).toEqual([]);
  });
});
