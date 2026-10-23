import { describe, expect, it } from "vitest";
import type { Fine, Offence } from "./types";
import { activeOffences, dayKeyOf, finesIn, jarTotal, monthKeyOf, shiftMonth, tallyByOffence, timeOf } from "./derive";

function offence(partial: Partial<Offence>): Offence {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    type: "swearjar_offence",
    title: "",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    updatedAt: "",
    deleted: 0,
    name: "Snoozed the alarm",
    price: 200,
    emoji: "",
    color: "",
    archived: false,
    ...partial,
  };
}

/** A Fine at local noon on `day`, so the month never depends on the test machine's zone. */
function fine(offenceId: string, day: string, amount: number): Fine {
  return {
    id: Math.random().toString(36).slice(2),
    type: "swearjar_fine",
    title: "",
    tags: [],
    folder: "",
    createdAt: day,
    updatedAt: "",
    deleted: 0,
    offenceId,
    amount,
    occurredAt: new Date(`${day}T12:00:00`).toISOString(),
    note: "",
  };
}

describe("months", () => {
  it("reads the local calendar month of an instant", () => {
    expect(monthKeyOf(new Date("2026-09-30T23:30:00").toISOString())).toBe("2026-09");
    expect(monthKeyOf(new Date("2026-10-01T00:10:00").toISOString())).toBe("2026-10");
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-09", -13)).toBe("2025-08");
  });
});

describe("the jar", () => {
  it("holds only the month's Fines, newest first", () => {
    const fs = [fine("a", "2026-08-31", 200), fine("a", "2026-09-02", 200), fine("a", "2026-09-20", 500)];
    const sept = finesIn(fs, "2026-09");
    expect(sept.map((f) => f.amount)).toEqual([500, 200]);
    expect(finesIn(fs, "2026-10")).toEqual([]);
  });

  it("sums the Fines' own amounts, not the Offence's current price", () => {
    // Repriced from €2 to €5 mid-month: the early Fines keep €2.
    const fs = [fine("a", "2026-09-02", 200), fine("a", "2026-09-10", 200), fine("a", "2026-09-20", 500)];
    expect(jarTotal(fs)).toBe(900);
  });

  it("tallies per Offence, costliest first, and keeps Fines of a missing Offence", () => {
    const alarm = offence({ id: "alarm", name: "Snoozed the alarm" });
    const swear = offence({ id: "swear", name: "Swore", price: 100 });
    const fs = [fine("alarm", "2026-09-01", 200), fine("swear", "2026-09-01", 100), fine("swear", "2026-09-02", 100), fine("swear", "2026-09-03", 100), fine("ghost", "2026-09-04", 50)];
    const rows = tallyByOffence([alarm, swear], fs);
    expect(rows.map((r) => [r.offenceId, r.count, r.total])).toEqual([
      ["swear", 3, 300],
      ["alarm", 1, 200],
      ["ghost", 1, 50],
    ]);
    expect(rows[2].offence).toBeUndefined();
  });
});

describe("offences", () => {
  it("offers only unarchived ones, by name", () => {
    const os = [offence({ name: "Swore" }), offence({ name: "Doomscrolled", archived: true }), offence({ name: "Ate junk" })];
    expect(activeOffences(os).map((o) => o.name)).toEqual(["Ate junk", "Swore"]);
  });
});

describe("local day and time", () => {
  it("read an instant in the local zone, not UTC", () => {
    const at = new Date(2026, 0, 1, 0, 30).toISOString();
    expect(dayKeyOf(at)).toBe("2026-01-01");
    expect(timeOf(at)).toBe("00:30");
  });
});
