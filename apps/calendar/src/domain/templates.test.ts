import { describe, expect, it } from "vitest";
import { compareTemplates, describeTemplate, durationOf, endOf, formatDuration } from "./templates";
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
  it("adds the duration to the start", () => {
    expect(endOf(tpl({ durationMin: 90 }), "09:00")).toBe("10:30");
    expect(endOf(tpl({ durationMin: 25 }), "09:50")).toBe("10:15");
  });
  it("stops at the end of the day", () => {
    expect(endOf(tpl({ durationMin: 180 }), "23:00")).toBe("24:00");
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
