import { describe, expect, it } from "vitest";
import { nearestReview, nearestWrittenDay } from "./nearest";
import { DAILY_TEMPLATE } from "./types";

const day = (title: string, body = "Rain.") => ({ type: "daily", title, body });
const review = (type: string, title: string) => ({ type, title, body: "" });

describe("nearestWrittenDay", () => {
  const days = [day("2023-02-04"), day("2023-02-20", DAILY_TEMPLATE), day("2023-03-13"), day("2023-03-20")];

  it("gives the nearest written Day strictly before and after", () => {
    expect(nearestWrittenDay(days, "2023-03-01")).toEqual({ before: "2023-02-04", after: "2023-03-13" });
    expect(nearestWrittenDay(days, "2023-03-13")).toEqual({ before: "2023-02-04", after: "2023-03-20" });
  });

  it("skips Days holding only their Template", () => {
    expect(nearestWrittenDay(days, "2023-02-25").before).toBe("2023-02-04");
    expect(nearestWrittenDay(days, "2023-02-10").after).toBe("2023-03-13");
  });

  it("gives nothing past either end", () => {
    expect(nearestWrittenDay(days, "2023-01-01")).toEqual({ before: undefined, after: "2023-02-04" });
    expect(nearestWrittenDay(days, "2023-04-01")).toEqual({ before: "2023-03-20", after: undefined });
    expect(nearestWrittenDay([], "2023-04-01")).toEqual({ before: undefined, after: undefined });
  });

  it("ignores other types", () => {
    expect(nearestWrittenDay([{ type: "thought", title: "2023-03-02", body: "x" }], "2023-03-01")).toEqual({ before: undefined, after: undefined });
  });
});

describe("nearestReview", () => {
  const notes = [review("month", "2022-11"), review("month", "2023-01"), review("month", "2023-06"), review("week", "2023-W05"), review("week", "2023-W12"), review("quarter", "2022-Q2"), review("year", "2021"), day("2023-03-05")];

  it("gives the nearest review of the same kind strictly before and after", () => {
    expect(nearestReview(notes, "2023-03")).toEqual({ before: "2023-01", after: "2023-06" });
    expect(nearestReview(notes, "2023-01")).toEqual({ before: "2022-11", after: "2023-06" });
    expect(nearestReview(notes, "2023-W08")).toEqual({ before: "2023-W05", after: "2023-W12" });
  });

  it("gives nothing past either end", () => {
    expect(nearestReview(notes, "2022-Q1")).toEqual({ before: undefined, after: "2022-Q2" });
    expect(nearestReview(notes, "2025")).toEqual({ before: "2021", after: undefined });
    expect(nearestReview(notes, "2023-07")).toEqual({ before: "2023-06", after: undefined });
  });

  it("orders weeks across year edges", () => {
    expect(nearestReview([review("week", "2020-W53"), review("week", "2021-W02")], "2021-W01")).toEqual({ before: "2020-W53", after: "2021-W02" });
  });

  it("gives nothing for a key that is not a period", () => {
    expect(nearestReview(notes, "2023-03-05")).toEqual({ before: undefined, after: undefined });
  });
});
