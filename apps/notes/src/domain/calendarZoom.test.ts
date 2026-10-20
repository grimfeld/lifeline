import { describe, expect, it } from "vitest";
import { YEARS_PER_PAGE, writtenMonths, writtenYears, yearsPage, yearsPageEnd } from "./calendarZoom";

const written = new Set(["1998-02-04", "1998-03-13", "2001-02-14", "2001-02-20"]);

describe("writtenMonths / writtenYears", () => {
  it("a month or a year is written when a written Day falls in it", () => {
    expect(writtenMonths(written)).toEqual(new Set(["1998-02", "1998-03", "2001-02"]));
    expect(writtenYears(written)).toEqual(new Set(["1998", "2001"]));
  });

  it("nothing written marks nothing", () => {
    expect(writtenMonths(new Set())).toEqual(new Set());
    expect(writtenYears(new Set())).toEqual(new Set());
  });
});

describe("yearsPage", () => {
  it("runs up to this year, twelve years a page, from the earliest written Day's year at most", () => {
    expect(yearsPage(2026, written, 2026)).toEqual({ years: Array.from({ length: 12 }, (_, i) => 2015 + i), earlier: true, later: false });
    expect(YEARS_PER_PAGE).toBe(12);
    expect(yearsPage(2026, new Set(["2020-05-01"]), 2026)).toEqual({ years: [2020, 2021, 2022, 2023, 2024, 2025, 2026], earlier: false, later: false });
  });

  it("pages of twelve end on this year; the earliest page stops at the earliest written year", () => {
    expect(yearsPage(2014, written, 2026)).toEqual({ years: [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014], earlier: true, later: true });
    expect(yearsPage(2002, written, 2026)).toEqual({ years: [1998, 1999, 2000, 2001, 2002], earlier: false, later: true });
  });

  it("with nothing written, the list is this year alone", () => {
    expect(yearsPage(2026, new Set(), 2026)).toEqual({ years: [2026], earlier: false, later: false });
  });

  it("written Days only in the future still list this year", () => {
    expect(yearsPage(2026, new Set(["2030-01-01"]), 2026)).toEqual({ years: [2026], earlier: false, later: false });
  });
});

describe("yearsPageEnd", () => {
  it("is the last year of the page holding a year, pages ending on this year", () => {
    expect(yearsPageEnd(2026, written, 2026)).toBe(2026);
    expect(yearsPageEnd(2015, written, 2026)).toBe(2026);
    expect(yearsPageEnd(2014, written, 2026)).toBe(2014);
    expect(yearsPageEnd(2001, written, 2026)).toBe(2002);
  });

  it("a year outside the list takes the nearest page", () => {
    expect(yearsPageEnd(1990, written, 2026)).toBe(2002);
    expect(yearsPageEnd(2040, written, 2026)).toBe(2026);
  });
});
