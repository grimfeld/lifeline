import { describe, expect, it } from "vitest";
import { sweptRange } from "./hours";

/** A desk sweep over empty hours (#226): the range drawn between where the press began and where the pointer is. */
describe("sweptRange", () => {
  it("runs from the quarter hour pressed to the quarter hour the pointer has reached", () => {
    expect(sweptRange(10.1, 11.6, 0, 24)).toEqual({ startH: 10, endH: 11.75 });
  });

  it("covers at least the quarter hour pressed", () => {
    expect(sweptRange(10.1, 10.12, 0, 24)).toEqual({ startH: 10, endH: 10.25 });
  });

  it("sweeping up runs from where the pointer is to the end of the quarter pressed", () => {
    expect(sweptRange(10.1, 8.6, 0, 24)).toEqual({ startH: 8.5, endH: 10.25 });
  });

  it("stays inside the hours shown", () => {
    expect(sweptRange(7.2, 3, 7, 22)).toEqual({ startH: 7, endH: 7.25 });
    expect(sweptRange(20, 30, 7, 22)).toEqual({ startH: 20, endH: 22 });
  });
});
