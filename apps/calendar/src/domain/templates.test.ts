import { describe, expect, it } from "vitest";
import { compareTemplates, describeTemplate, durationOf, endOf, formatDuration, fillFromTemplate } from "./templates";
import type { EventTemplate } from "./types";

function tpl(over: Partial<EventTemplate> = {}): EventTemplate {
  return {
    id: "t1",
    type: "event_template",
    title: "Gym",
    tags: [],
    folder: "",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01T00:00:00Z",
    deleted: 0,
    notes: "",
    defaultStart: "18:00",
    durationMin: 60,
    allDay: false,
    ...over,
  } as EventTemplate;
}

describe("durationOf", () => {
  it("falls back to an hour for a missing or nonsense length", () => {
    expect(durationOf(tpl({ durationMin: 0 }))).toBe(60);
    expect(durationOf(tpl({ durationMin: -30 }))).toBe(60);
    expect(durationOf(tpl({ durationMin: 45 }))).toBe(45);
  });
});

describe("endOf", () => {
  it("adds the length to the start, on the same day", () => {
    expect(endOf(tpl({ durationMin: 90 }), "2026-08-24", "09:00")).toEqual({ endDate: "2026-08-24", end: "10:30" });
    expect(endOf(tpl({ durationMin: 25 }), "2026-08-24", "09:50")).toEqual({ endDate: "2026-08-24", end: "10:15" });
  });
  it("runs past midnight into the next day", () => {
    expect(endOf(tpl({ durationMin: 180 }), "2026-08-24", "23:00")).toEqual({ endDate: "2026-08-25", end: "02:00" });
  });
  it("ends at 00:00 the next day, never 24:00, when it reaches midnight", () => {
    expect(endOf(tpl({ durationMin: 60 }), "2026-08-24", "23:00")).toEqual({ endDate: "2026-08-25", end: "00:00" });
  });
});

describe("formatDuration", () => {
  it("reads as hours and minutes", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30");
  });
});

describe("describeTemplate", () => {
  it("says all day for an all-day template", () => {
    expect(describeTemplate(tpl({ allDay: true }))).toBe("All day");
  });
  it("says the length, and the preferred start when it has one", () => {
    expect(describeTemplate(tpl({ defaultStart: null, durationMin: 30 }))).toBe("30 min");
    expect(describeTemplate(tpl({ durationMin: 60 }))).toMatch(/^1 h · from /);
  });
});

describe("compareTemplates", () => {
  it("sorts by title", () => {
    const names = [tpl({ title: "Standup" }), tpl({ title: "Gym" })].sort(compareTemplates).map((t) => t.title);
    expect(names).toEqual(["Gym", "Standup"]);
  });
});

describe("fillFromTemplate", () => {
  const draft = { title: "", notes: "", with: [] as string[], tags: [] as string[], date: "2026-11-20", endDate: "", allDay: false, start: "09:00", end: "10:00" };

  it("takes the title, the usual start and the length, on the draft's day", () => {
    const f = fillFromTemplate(tpl({ title: "Gym", defaultStart: "18:00", durationMin: 90 }), draft);
    expect(f).toMatchObject({ title: "Gym", date: "2026-11-20", allDay: false, start: "18:00", end: "19:30", endDate: "" });
  });

  it("lets a given start win over the usual one, keeping the template's length", () => {
    const f = fillFromTemplate(tpl({ defaultStart: "18:00", durationMin: 30 }), draft, "11:15");
    expect(f).toMatchObject({ start: "11:15", end: "11:45" });
  });

  it("keeps the draft's start when the template has none", () => {
    const f = fillFromTemplate(tpl({ defaultStart: null, durationMin: 45 }), { ...draft, start: "14:00" });
    expect(f).toMatchObject({ start: "14:00", end: "14:45" });
  });

  it("rolls past midnight onto the next day", () => {
    const f = fillFromTemplate(tpl({ defaultStart: "23:00", durationMin: 120 }), draft);
    expect(f).toMatchObject({ start: "23:00", end: "01:00", endDate: "2026-11-21" });
  });

  it("makes an all-day draft for an all-day template, on one day", () => {
    const f = fillFromTemplate(tpl({ allDay: true, defaultStart: null }), { ...draft, endDate: "2026-11-22" }, "10:00");
    expect(f).toMatchObject({ allDay: true, endDate: "" });
  });

  it("adds the template's notes and Tags to what is there", () => {
    const f = fillFromTemplate(tpl({ notes: "Bring towel", tags: ["health"] }), { ...draft, notes: "Leg day", tags: ["a", "health"] });
    expect(f.notes).toBe("Leg day\nBring towel");
    expect(f.tags).toEqual(["a", "health"]);
    expect(fillFromTemplate(tpl({ notes: "Bring towel" }), draft).notes).toBe("Bring towel");
  });
});
