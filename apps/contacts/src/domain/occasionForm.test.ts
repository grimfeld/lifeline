import { describe, expect, it } from "vitest";
import { asksMonthDay, dayWhenNoYear, daysIn, monthDay, occasionDraft, occasionInput, pickerDay } from "./occasionForm";

describe("the Occasion dialog", () => {
  it("opens blank and yearly for a new Occasion", () => {
    expect(occasionDraft("new")).toEqual({ label: "", day: "", yearly: true, noYear: false });
  });
  it("opens on the Occasion as it is, knowing whether its year is known", () => {
    expect(occasionDraft({ id: "o", label: "Birthday", day: "03-04", yearly: true })).toEqual({ label: "Birthday", day: "03-04", yearly: true, noYear: true });
    expect(occasionDraft({ id: "o", label: "Surgery", day: "2026-05-12", yearly: false })).toEqual({ label: "Surgery", day: "2026-05-12", yearly: false, noYear: false });
  });
  it("asks for a month and a day only for a yearly Occasion with no year", () => {
    expect(asksMonthDay({ yearly: true, noYear: true })).toBe(true);
    expect(asksMonthDay({ yearly: true, noYear: false })).toBe(false);
    expect(asksMonthDay({ yearly: false, noYear: true })).toBe(false);
  });
  it("saves only the month and day of a yearly Occasion with no year, and the whole day otherwise", () => {
    expect(occasionInput({ label: "Met", day: "2026-03-04", yearly: true, noYear: true })).toEqual({ label: "Met", day: "03-04", yearly: true });
    expect(occasionInput({ label: "Met", day: "2026-03-04", yearly: true, noYear: false })).toEqual({ label: "Met", day: "2026-03-04", yearly: true });
    expect(occasionInput({ label: "Met", day: "03-04", yearly: true, noYear: true })).toEqual({ label: "Met", day: "03-04", yearly: true });
    // Once again, the year is needed: what was typed goes to the repo, which refuses a yearless once day.
    expect(occasionInput({ label: "Met", day: "03-04", yearly: false, noYear: true })).toEqual({ label: "Met", day: "03-04", yearly: false });
  });
  it("keeps the month and day when the year is dropped, and empties the day when it is wanted again", () => {
    expect(dayWhenNoYear("1961-03-04", true)).toBe("03-04");
    expect(dayWhenNoYear("03-04", false)).toBe("");
    expect(dayWhenNoYear("03-04", true)).toBe("03-04");
  });
  it("gives the date picker only a full day", () => {
    expect(pickerDay("1961-03-04")).toBe("1961-03-04");
    expect(pickerDay("03-04")).toBe("");
    expect(pickerDay("")).toBe("");
  });
});

describe("a month and a day with no year", () => {
  it("allows 29 February, 30 days in April and 31 before a month is picked", () => {
    expect(["01", "02", "04", "12", ""].map(daysIn)).toEqual([31, 29, 30, 31, 31]);
  });
  it("moves a day past the new month's end to its last day, and keeps one within it", () => {
    expect(monthDay("04", "31")).toBe("04-30");
    expect(monthDay("02", "30")).toBe("02-29");
    expect(monthDay("04", "30")).toBe("04-30");
    expect(monthDay("05", "31")).toBe("05-31");
    expect(monthDay("05", "")).toBe("05-");
    expect(monthDay("", "12")).toBe("-12");
  });
});
