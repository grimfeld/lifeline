import { describe, expect, it } from "vitest";
import { fireMarkId, occurrencesOf, planFires, talliesOf, type Tally } from "./tallying";

const habit: Tally = { target: "lifelevel/h1", value: "one" };
const minutes: Tally = { target: "stats/s1", value: "duration" };

describe("talliesOf", () => {
  it("reads an absent or malformed field as no Tallies", () => {
    expect(talliesOf({ tallies: null })).toEqual([]);
    expect(talliesOf({ tallies: "" })).toEqual([]);
    expect(talliesOf(undefined)).toEqual([]);
    expect(talliesOf({ tallies: [{ target: "" }, null, { value: "one" }] })).toEqual([]);
  });

  it("defaults a missing value to one", () => {
    expect(talliesOf({ tallies: [{ target: "stats/s1" }] })).toEqual([{ target: "stats/s1", value: "one" }]);
  });
});

describe("planFires", () => {
  const occ = { key: "2026-09-30", at: "2026-09-30T08:00:00.000Z", values: { duration: 34 } };

  it("logs each Tally once, with the value it asks for", () => {
    const plan = planFires("d1", [habit, minutes], occ, new Set());
    expect(plan.map((p) => [p.target, p.payload.value])).toEqual([
      ["lifelevel/h1", 1],
      ["stats/s1", 34],
    ]);
    expect(plan.every((p) => p.payload.at === occ.at)).toBe(true);
  });

  it("skips a Tally already fired for this occurrence — one occurrence logs once", () => {
    const fired = new Set([fireMarkId("d1", "lifelevel/h1", "2026-09-30")]);
    expect(planFires("d1", [habit, minutes], occ, fired).map((p) => p.target)).toEqual(["stats/s1"]);
  });

  it("fires again for a different occurrence", () => {
    const fired = new Set([fireMarkId("d1", "lifelevel/h1", "2026-09-29")]);
    expect(planFires("d1", [habit], occ, fired)).toHaveLength(1);
  });

  it("sends one when the occurrence did not measure the asked value", () => {
    const plan = planFires("d1", [minutes], { key: "k", at: occ.at }, new Set());
    expect(plan[0]!.payload.value).toBe(1);
  });
});

describe("occurrences", () => {
  const recall: Tally = { target: "lifelevel/h1", value: "one", occurrence: "puzzle" };
  const plain: Tally = { target: "stats/s1", value: "one" };
  const day = { key: "d1", at: "2026-09-30T08:00:00.000Z" };

  it("a type lists several occurrences; one stays valid", () => {
    expect(occurrencesOf({ typeId: "t", occurrence: "day practised" }).map((o) => o.id)).toEqual(["day practised"]);
    const two = occurrencesOf({ typeId: "t", occurrence: "day practised", occurrences: [{ id: "day", label: "day practised" }, { id: "puzzle", label: "puzzle solved" }] });
    expect(two.map((o) => o.id)).toEqual(["day", "puzzle"]);
  });

  it("keeps the occurrence a Tally records, and reads none as none", () => {
    expect(talliesOf({ tallies: [{ target: "a/b", occurrence: "puzzle" }, { target: "a/c" }] })).toEqual([
      { target: "a/b", value: "one", occurrence: "puzzle" },
      { target: "a/c", value: "one" },
    ]);
  });

  it("a Tally without an occurrence counts the type's first", () => {
    expect(planFires("d", [plain], { ...day, occurrence: "day" }, new Set(), "day")).toHaveLength(1);
    expect(planFires("d", [plain], day, new Set(), "day")).toHaveLength(1);
    expect(planFires("d", [plain], { ...day, occurrence: "puzzle" }, new Set(), "day")).toHaveLength(0);
  });

  it("firing an occurrence fires only the Tallies set to it", () => {
    const tallies = [plain, recall];
    expect(planFires("d", tallies, { ...day, occurrence: "puzzle" }, new Set(), "day").map((p) => p.target)).toEqual(["lifelevel/h1"]);
    expect(planFires("d", tallies, day, new Set(), "day").map((p) => p.target)).toEqual(["stats/s1"]);
  });

  it("an explicit first occurrence also counts the first", () => {
    const explicit: Tally = { target: "a/b", value: "one", occurrence: "day" };
    expect(planFires("d", [explicit], day, new Set(), "day")).toHaveLength(1);
  });
});
