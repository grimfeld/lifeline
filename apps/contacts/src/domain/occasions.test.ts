import { describe, expect, it } from "vitest";
import type { Occasion } from "./types";
import { ageOf, describeDay, normalizeOccasions, occasionDateIn, occasionMarkersIn, occasionProblem, personOfMarker, upcomingOccasions, whenOf, type PersonOccasions } from "./occasions";

const anne = (...occasions: Occasion[]): PersonOccasions => ({ id: "p1", title: "Anne", tags: ["family"], occasions });
const bday = (day: string): Occasion => ({ id: "o1", label: "Birthday", day, yearly: true });
const range = (start: string, end: string) => ({ start, end });
const lines = (people: PersonOccasions[], r: { start: string; end: string }) => occasionMarkersIn(people, r).map((m) => [m.date, m.title]);

describe("Occasion markers in a range", () => {
  it("shows a Birthday with the age reached, every year", () => {
    const people = [anne(bday("1961-03-04"))];
    expect(lines(people, range("2026-03-01", "2026-03-31"))).toEqual([["2026-03-04", "🎂 Anne · 65"]]);
    expect(lines(people, range("2027-03-01", "2027-03-31"))).toEqual([["2027-03-04", "🎂 Anne · 66"]]);
  });

  it("shows a Birthday with no known year without an age", () => {
    expect(lines([anne(bday("03-04"))], range("2026-03-01", "2026-03-31"))).toEqual([["2026-03-04", "🎂 Anne"]]);
  });

  it("matches Birthday however it is cased, and keeps other yearly labels age-free", () => {
    const people = [anne({ id: "a", label: " birthday ", day: "1961-03-04", yearly: true }, { id: "b", label: "Wedding", day: "1990-06-02", yearly: true })];
    expect(lines(people, range("2026-03-01", "2026-06-30"))).toEqual([["2026-03-04", "🎂 Anne · 65"], ["2026-06-02", "⚑ Anne · Wedding"]]);
  });

  it("stands a once Occasion only on its own day", () => {
    const people = [{ ...anne({ id: "s", label: "Surgery", day: "2026-05-12", yearly: false }), title: "Marc" }];
    expect(lines(people, range("2026-05-01", "2026-05-31"))).toEqual([["2026-05-12", "⚑ Marc · Surgery"]]);
    expect(lines(people, range("2027-05-01", "2027-05-31"))).toEqual([]);
  });

  it("does not show a yearly Occasion before the year it began", () => {
    expect(lines([anne(bday("1961-03-04"))], range("1950-03-01", "1950-03-31"))).toEqual([]);
  });

  it("shows February 29 on February 28 in a year that is not a leap year, and on the 29th in one that is", () => {
    const people = [anne(bday("2000-02-29"))];
    expect(lines(people, range("2026-02-01", "2026-03-31"))).toEqual([["2026-02-28", "🎂 Anne · 26"]]);
    expect(lines(people, range("2028-02-01", "2028-03-31"))).toEqual([["2028-02-29", "🎂 Anne · 28"]]);
  });

  it("covers a range across a year end", () => {
    const people = [anne({ id: "n", label: "Name day", day: "01-01", yearly: true }), anne({ id: "m", label: "Met", day: "12-31", yearly: true })];
    expect(lines(people, range("2026-12-30", "2027-01-02"))).toEqual([["2026-12-31", "⚑ Anne · Met"], ["2027-01-01", "⚑ Anne · Name day"]]);
  });

  it("skips whatever is stored under the key that is no Occasion (a Base's text, a damaged row)", () => {
    const junk = { id: "p2", title: "Marc", tags: [], occasions: "Birthday on the 4th" as never };
    const mixed = { id: "p3", title: "Léa", tags: [], occasions: [null, { label: 3 }, bday("1990-03-10")] as never };
    expect(lines([junk, mixed], range("2026-03-01", "2026-03-31"))).toEqual([["2026-03-10", "🎂 Léa · 36"]]);
  });

  it("makes read-only all-day occasion markers carrying the Person's Tags, unique per occurrence", () => {
    const [m] = occasionMarkersIn([anne(bday("1961-03-04"))], range("2026-03-01", "2026-03-31"));
    expect(m).toMatchObject({ appId: "contacts", itemId: "p1:o1@2026-03-04", start: null, end: null, marker: true, occasion: true, tags: ["family"] });
    expect(m?.key).toBe("contacts/p1:o1@2026-03-04");
  });
});

describe("a Person's age", () => {
  it("is the years since a known Birthday year, until the day comes round", () => {
    const occasions = [bday("1961-03-04")];
    expect(ageOf(occasions, "2026-03-03")).toBe(64);
    expect(ageOf(occasions, "2026-03-04")).toBe(65);
  });
  it("is null with no Birthday or no known year", () => {
    expect(ageOf([bday("03-04")], "2026-03-04")).toBeNull();
    expect(ageOf([], "2026-03-04")).toBeNull();
  });
  it("counts a February 29 Birthday as reached on February 28 in a common year", () => {
    expect(ageOf([bday("2000-02-29")], "2026-02-27")).toBe(25);
    expect(ageOf([bday("2000-02-29")], "2026-02-28")).toBe(26);
  });
  it("is null for a Birthday in the future", () => {
    expect(ageOf([bday("2030-01-01")], "2026-03-04")).toBeNull();
  });
  it("is null when they were born this year and the day has not come yet", () => {
    expect(ageOf([bday("2026-06-01")], "2026-03-04")).toBeNull();
    expect(ageOf([bday("2026-06-01")], "2026-06-01")).toBe(0);
  });
  it("is never read from a once Occasion, even one called Birthday", () => {
    expect(ageOf([{ id: "o1", label: "Birthday", day: "1961-03-04", yearly: false }], "2026-03-04")).toBeNull();
  });
});

describe("the day an Occasion falls on", () => {
  it("clamps February 29", () => {
    expect(occasionDateIn("02-29", 2026)).toBe("2026-02-28");
    expect(occasionDateIn("02-29", 2024)).toBe("2024-02-29");
  });
});

describe("Occasion rules", () => {
  it("refuses an empty label, a bad day, and a once Occasion with no year", () => {
    expect(occasionProblem({ label: " ", day: "03-04", yearly: true })).toBe("An Occasion needs a label");
    expect(occasionProblem({ label: "x", day: "13-40", yearly: true })).toBe("Pick a real day");
    expect(occasionProblem({ label: "x", day: "03-04", yearly: false })).toBe("A once Occasion needs its year");
    expect(occasionProblem({ label: "x", day: "2026-02-30", yearly: false })).toBe("Pick a real day");
    expect(occasionProblem({ label: "x", day: "02-29", yearly: true })).toBeNull();
    expect(occasionProblem({ label: "x", day: "2026-05-12", yearly: false })).toBeNull();
  });
  it("normalizes stored junk away", () => {
    expect(normalizeOccasions(undefined)).toEqual([]);
    expect(normalizeOccasions([{ id: "a", label: "A", day: "03-04", yearly: true }, { nope: 1 }, null])).toEqual([{ id: "a", label: "A", day: "03-04", yearly: true }]);
  });
});

describe("Upcoming", () => {
  const marc: PersonOccasions = { id: "p2", title: "Marc", occasions: [{ id: "s", label: "Surgery", day: "2027-01-03", yearly: false }, { id: "w", label: "Wedding", day: "1990-12-30", yearly: true }] };
  const people = [anne(bday("1961-01-02")), marc];

  it("crosses a year end, soonest first, with the ages reached", () => {
    expect(upcomingOccasions(people, "2026-12-28", 10)).toEqual([
      { personId: "p2", occasionId: "w", name: "Marc", label: "Wedding", date: "2026-12-30", inDays: 2, age: null },
      { personId: "p1", occasionId: "o1", name: "Anne", label: "Birthday", date: "2027-01-02", inDays: 5, age: 66 },
      { personId: "p2", occasionId: "s", name: "Marc", label: "Surgery", date: "2027-01-03", inDays: 6, age: null },
    ]);
  });

  it("includes both ends of the window", () => {
    expect(upcomingOccasions(people, "2026-12-30", 0).map((u) => u.label)).toEqual(["Wedding"]);
    expect(upcomingOccasions(people, "2026-12-29", 4).map((u) => u.label)).toEqual(["Wedding", "Birthday"]);
  });

  it("gives a Birthday with no year no age", () => {
    expect(upcomingOccasions([anne(bday("01-02"))], "2026-12-28", 10)).toMatchObject([{ date: "2027-01-02", age: null }]);
  });

  it("is empty when nothing falls in the window", () => {
    expect(upcomingOccasions(people, "2026-06-01", 30)).toEqual([]);
    expect(upcomingOccasions([], "2026-06-01", 30)).toEqual([]);
  });

  it("shows February 29 on February 28 in a year that is not a leap year", () => {
    expect(upcomingOccasions([anne(bday("2000-02-29"))], "2027-02-20", 14)).toMatchObject([{ date: "2027-02-28", age: 27 }]);
  });
});

describe("markers carry the age a Birthday reaches", () => {
  it("sets age on a Birthday with a year, and on nothing else", () => {
    const people: PersonOccasions[] = [
      { id: "p", title: "Anne", occasions: [{ id: "a", label: "Birthday", day: "1961-11-12", yearly: true }, { id: "b", label: "Surgery", day: "2026-11-12", yearly: false }, { id: "c", label: "Birthday", day: "03-20", yearly: true }] },
    ];
    const items = occasionMarkersIn(people, { start: "2026-11-12", end: "2026-11-12" });
    expect(items.map((i) => [i.itemId, i.age])).toEqual(expect.arrayContaining([["p:a@2026-11-12", 65], ["p:b@2026-11-12", undefined]]));
  });
});

describe("what is a real day", () => {
  it("refuses a month or a day out of its bounds, with or without a year", () => {
    for (const day of ["00-10", "13-01", "03-00", "04-31", "2026-00-10", "2026-13-01", "2026-03-00", "2026-04-31", "3-4", "2026-3-04", "x2026-03-04", "2026-03-04x"]) {
      expect(occasionProblem({ label: "x", day, yearly: true }), day).toBe("Pick a real day");
    }
  });
  it("takes the last day of each month and 29 February only in a leap year or with no year", () => {
    for (const day of ["01-31", "12-31", "12-01", "02-29", "2024-02-29", "2026-04-30"]) expect(occasionProblem({ label: "x", day, yearly: true }), day).toBeNull();
    expect(occasionProblem({ label: "x", day: "2026-02-29", yearly: true })).toBe("Pick a real day");
  });
  it("puts a day that is no day on no date", () => {
    expect(occasionDateIn("13-01", 2026)).toBe("");
  });
});

describe("an Occasion's day in words", () => {
  it("reads with its year, or without one when it is unknown", () => {
    expect(describeDay("1961-03-04", "en-GB")).toBe("4 March 1961");
    expect(describeDay("03-04", "en-GB")).toBe("4 March");
    expect(describeDay("12-31", "en-GB")).toBe("31 December");
  });
  it("reads 29 February with no year, and text that is no day as it is", () => {
    expect(describeDay("02-29", "en-GB")).toBe("29 February");
    expect(describeDay("someday", "en-GB")).toBe("someday");
  });
});

describe("how soon an Upcoming Occasion is", () => {
  it("says today, tomorrow, or in how many days", () => {
    expect([0, 1, 2, 30].map(whenOf)).toEqual(["today", "tomorrow", "in 2 days", "in 30 days"]);
  });
});

describe("ages and years from damaged or unusual rows", () => {
  it("passes over a Birthday whose day is no day, to the next one", () => {
    expect(ageOf([bday("someday"), bday("1961-03-04")], "2026-03-04")).toBe(65);
  });
  it("passes over a Birthday with no year to one with a year", () => {
    expect(ageOf([bday("03-04"), bday("1961-03-04")], "2026-03-04")).toBe(65);
  });
  it("shows a yearly Occasion in the very year it began, with age 0", () => {
    expect(upcomingOccasions([anne(bday("2026-03-04"))], "2026-03-01", 10)).toMatchObject([{ date: "2026-03-04", age: 0 }]);
  });
  it("shows a yearly Occasion every year of a range several years long", () => {
    expect(lines([anne(bday("2020-03-04"))], range("2024-01-01", "2026-12-31")).map(([d]) => d)).toEqual(["2024-03-04", "2025-03-04", "2026-03-04"]);
  });
  it("skips an Occasion with no label, and a once one with no year", () => {
    const people = [anne({ id: "a", label: " ", day: "03-04", yearly: true }, { id: "b", label: "Met", day: "03-05", yearly: false })];
    expect(lines(people, range("2026-03-01", "2026-03-31"))).toEqual([]);
  });
  it("is 0 in the year after birth until the day comes round", () => {
    expect(ageOf([bday("2025-06-01")], "2026-03-04")).toBe(0);
  });
  it("puts Occasions on the same day by name, then by label", () => {
    const zoe: PersonOccasions = { id: "z", title: "Zoe", occasions: [{ id: "w", label: "Wedding", day: "05-01", yearly: true }, { id: "m", label: "Met", day: "05-01", yearly: true }] };
    const ann: PersonOccasions = { id: "a", title: "Ann", occasions: [{ id: "w", label: "Wedding", day: "05-01", yearly: true }] };
    expect(upcomingOccasions([zoe, ann], "2026-05-01", 0).map((u) => `${u.name} ${u.label}`)).toEqual(["Ann Wedding", "Zoe Met", "Zoe Wedding"]);
  });
  it("finds the Person of a marker", () => {
    expect(personOfMarker("p1:o1@2026-03-04")).toBe("p1");
    expect(personOfMarker("")).toBe("");
  });
});
