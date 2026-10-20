import { describe, expect, it } from "vitest";
import { pageTo, pagingStep } from "./paging";
import { DAILY_TEMPLATE } from "./types";

const key = (k: string, mods: { altKey?: boolean; shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean; defaultPrevented?: boolean } = {}) => ({
  key: k,
  altKey: false,
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  defaultPrevented: false,
  ...mods,
});

describe("pagingStep", () => {
  it("reads Alt+←/→ as one step and Alt+Shift+←/→ as a skip to the next written page", () => {
    expect(pagingStep(key("ArrowLeft", { altKey: true }))).toEqual({ by: -1, skip: false });
    expect(pagingStep(key("ArrowRight", { altKey: true }))).toEqual({ by: 1, skip: false });
    expect(pagingStep(key("ArrowLeft", { altKey: true, shiftKey: true }))).toEqual({ by: -1, skip: true });
    expect(pagingStep(key("ArrowRight", { altKey: true, shiftKey: true }))).toEqual({ by: 1, skip: true });
  });

  it("leaves every other key alone", () => {
    expect(pagingStep(key("ArrowLeft"))).toBeUndefined();
    expect(pagingStep(key("ArrowUp", { altKey: true }))).toBeUndefined();
    expect(pagingStep(key("ArrowLeft", { altKey: true, ctrlKey: true }))).toBeUndefined();
    expect(pagingStep(key("ArrowRight", { altKey: true, metaKey: true }))).toBeUndefined();
    expect(pagingStep(key("ArrowRight", { altKey: true, defaultPrevented: true }))).toBeUndefined();
  });
});

describe("pageTo", () => {
  const notes = [
    { type: "daily", title: "2023-02-04", body: "Rain." },
    { type: "daily", title: "2023-02-20", body: DAILY_TEMPLATE },
    { type: "daily", title: "2023-03-13", body: "Sun." },
    { type: "month", title: "2022-11", body: "" },
    { type: "month", title: "2023-05", body: "" },
    { type: "week", title: "2023-W05", body: "" },
  ];

  it("steps a Day by one calendar day, written or not", () => {
    expect(pageTo(notes, "2023-03-01", { by: -1, skip: false })).toBe("2023-02-28");
    expect(pageTo(notes, "2023-12-31", { by: 1, skip: false })).toBe("2024-01-01");
  });

  it("skips from a Day to the nearest written Day, past Template-only ones", () => {
    expect(pageTo(notes, "2023-03-01", { by: -1, skip: true })).toBe("2023-02-04");
    expect(pageTo(notes, "2023-02-10", { by: 1, skip: true })).toBe("2023-03-13");
  });

  it("steps a period by one of its kind", () => {
    expect(pageTo(notes, "2023-01", { by: -1, skip: false })).toBe("2022-12");
    expect(pageTo(notes, "2023-W01", { by: -1, skip: false })).toBe("2022-W52");
    expect(pageTo(notes, "2023-Q4", { by: 1, skip: false })).toBe("2024-Q1");
    expect(pageTo(notes, "2023", { by: 1, skip: false })).toBe("2024");
  });

  it("skips from a period to the nearest of its kind with a review", () => {
    expect(pageTo(notes, "2023-02", { by: -1, skip: true })).toBe("2022-11");
    expect(pageTo(notes, "2023-02", { by: 1, skip: true })).toBe("2023-05");
    expect(pageTo(notes, "2023-W09", { by: -1, skip: true })).toBe("2023-W05");
  });

  it("goes nowhere when there is nothing written that way", () => {
    expect(pageTo(notes, "2023-04-01", { by: 1, skip: true })).toBeUndefined();
    expect(pageTo(notes, "2023-01-01", { by: -1, skip: true })).toBeUndefined();
    expect(pageTo(notes, "2023-06", { by: 1, skip: true })).toBeUndefined();
    expect(pageTo(notes, "2023-Q2", { by: -1, skip: true })).toBeUndefined();
  });

  it("goes nowhere from what is neither a date nor a period", () => {
    expect(pageTo(notes, "soon", { by: 1, skip: false })).toBeUndefined();
  });
});
