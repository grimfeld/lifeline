import { describe, expect, it } from "vitest";
import { argProblems, commandRun, initialList, initialMoment, initialNumber, initialText, invokeCommand, linkProblemText, matchLink, matchLinks, momentOf, pickLinked, pickLinks, readCommandArgs } from "./commands";
import type { CommandArg, CommandDef } from "./manifest";

const ARGS: CommandArg[] = [
  { key: "title", label: "Title", kind: "text", required: true },
  { key: "date", label: "Date", kind: "date" },
  { key: "start", label: "Start", kind: "time" },
  { key: "minutes", label: "Minutes", kind: "number" },
  { key: "tags", label: "Tags", kind: "list" },
  { key: "mood", label: "Mood", kind: "select", options: [{ value: "good", label: "Good" }, { value: "bad", label: "Bad" }] },
  { key: "rule", label: "Rule", kind: "json" },
];

describe("readCommandArgs", () => {
  it("coerces values to their declared kinds and drops absent ones", async () => {
    expect(await readCommandArgs(ARGS, { title: "  Dentist ", date: "2026-10-02", minutes: "30", tags: "a, b", rule: '{"kind":"weekly"}' })).toEqual({
      title: "Dentist",
      date: "2026-10-02",
      minutes: 30,
      tags: ["a", "b"],
      rule: { kind: "weekly" },
    });
  });

  it("refuses a missing required argument, an unknown one, and malformed values", async () => {
    await expect(readCommandArgs(ARGS, {})).rejects.toThrow("Title is required");
    await expect(readCommandArgs(ARGS, { title: "x", colour: "red" })).rejects.toThrow("Unknown argument: colour");
    await expect(readCommandArgs(ARGS, { title: "x", date: "2026-02-30" })).rejects.toThrow("YYYY-MM-DD");
    await expect(readCommandArgs(ARGS, { title: "x", start: "25:00" })).rejects.toThrow("HH:MM");
    await expect(readCommandArgs(ARGS, { title: "x", mood: "meh" })).rejects.toThrow("good, bad");
    await expect(readCommandArgs(ARGS, { title: "x", minutes: "lots" })).rejects.toThrow("number");
  });
});

describe("rows arguments", () => {
  const LINES: CommandArg[] = [
    {
      key: "lines",
      label: "Lines",
      kind: "rows",
      required: true,
      of: [
        { key: "label", label: "Label", kind: "text", required: true },
        { key: "price", label: "Price", kind: "number", required: true },
        { key: "promo", label: "Promo", kind: "boolean" },
      ],
    },
  ];

  it("checks every row against the row signature", async () => {
    expect(await readCommandArgs(LINES, { lines: [{ label: " Milk ", price: "1.2" }, { label: "Eggs", price: 3, promo: true }] })).toEqual({
      lines: [
        { label: "Milk", price: 1.2 },
        { label: "Eggs", price: 3, promo: true },
      ],
    });
    expect(await readCommandArgs(LINES, { lines: '[{"label":"Milk","price":1}]' })).toEqual({ lines: [{ label: "Milk", price: 1 }] });
  });

  it("names the row a bad value is in, and counts an empty list as missing", async () => {
    await expect(readCommandArgs(LINES, { lines: [{ label: "Milk", price: 1 }, { label: "Eggs" }] })).rejects.toThrow("Lines, row 2: Price is required");
    await expect(readCommandArgs(LINES, { lines: [{ label: "Milk", price: 1, colour: "red" }] })).rejects.toThrow("Lines, row 1: Unknown argument: colour");
    await expect(readCommandArgs(LINES, { lines: ["Milk"] })).rejects.toThrow("Lines, row 1: expected a record");
    await expect(readCommandArgs(LINES, { lines: [] })).rejects.toThrow("Lines is required");
  });
});

describe("argProblems", () => {
  it("says what is wrong with each value, by its argument, so a form shows it under that field", async () => {
    expect(await argProblems(ARGS, { minutes: "lots", date: "tomorrow" })).toEqual({
      title: "Title is required",
      date: "Date: expected a date as YYYY-MM-DD",
      minutes: "Minutes: expected a number",
    });
    expect(await argProblems(ARGS, { title: "Walk" })).toEqual({});
  });
});

describe("invokeCommand", () => {
  it("passes checked arguments to the App's invoke", async () => {
    const def: CommandDef = { id: "t.add", title: "Add", args: ARGS, invoke: async (a) => ({ message: `added ${a.title}` }) };
    expect(await invokeCommand(def, { title: "Gym" })).toEqual({ message: "added Gym" });
  });

  it("refuses a Command that has only a dialog", async () => {
    await expect(invokeCommand({ id: "t.x", title: "Dialog only" }, {})).rejects.toThrow("cannot be run without its dialog");
  });
});

describe("momentOf", () => {
  const now = new Date("2026-10-02T15:00:00");
  it("is undefined without a day, the day at noon or at the time otherwise", () => {
    expect(momentOf(undefined, undefined, now)).toBeUndefined();
    expect(momentOf("2026-10-01", undefined, now)).toBe(new Date("2026-10-01T12:00").toISOString());
    expect(momentOf("2026-10-02", "09:30", now)).toBe(new Date("2026-10-02T09:30").toISOString());
  });
  it("refuses a time alone and a moment still to come", () => {
    expect(() => momentOf(undefined, "09:00", now)).toThrow("needs a day");
    expect(() => momentOf("2026-10-02", "16:00", now)).toThrow("still to come");
  });
});

describe("link arguments: an id, the title or an alias, never a guess", () => {
  const STAT: CommandArg = { key: "stat", label: "Stat", kind: "link", linkType: "stat" };
  const docs = [
    { id: "s1", type: "stat", title: "Weight", aliases: ["Poids"] },
    { id: "s2", type: "stat", title: "Steps" },
    { id: "s3", type: "stat", title: "steps" },
    { id: "s4", type: "stat", title: "Café   consumed", aliases: [] },
    { id: "s5", type: "stat", title: "Sleep", aliases: ["Rest"] },
    { id: "s6", type: "stat", title: "Rest" },
    { id: "n1", type: "note", title: "Weight" },
    { id: "n2", type: "note", title: "Mood", aliases: ["Humeur"] },
  ];

  it("takes an id of the right type", () => {
    expect(pickLinked(STAT, "s2", docs)).toBe("s2");
    expect(matchLink(STAT, "s2", docs)).toEqual({ id: "s2" });
  });

  it("takes a title compared as wikilinks are: case, accents and repeated spaces folded", () => {
    expect(pickLinked(STAT, "  weight ", docs)).toBe("s1");
    expect(pickLinked(STAT, "cafe consumed", docs)).toBe("s4");
  });

  it("takes an alias the same way", () => {
    expect(pickLinked(STAT, "poids", docs)).toBe("s1");
  });

  it("looks only among the Documents of the argument's type", () => {
    expect(matchLink(STAT, "Humeur", docs)).toEqual({ problem: { kind: "unknown", label: "Stat", value: "Humeur" } });
    expect(matchLink(STAT, "n1", docs)).toEqual({ problem: { kind: "unknown", label: "Stat", value: "n1" } });
  });

  it("refuses a name that matches nothing, in the argument's own noun", () => {
    expect(() => pickLinked(STAT, "Weigth", docs)).toThrow("No Stat called “Weigth”");
  });

  it("refuses an ambiguous title, listing each candidate's title and id", () => {
    expect(matchLink(STAT, "STEPS", docs)).toEqual({
      problem: { kind: "ambiguous", label: "Stat", value: "STEPS", candidates: [{ id: "s2", title: "Steps" }, { id: "s3", title: "steps" }] },
    });
    expect(() => pickLinked(STAT, "STEPS", docs)).toThrow("“STEPS” is more than one Stat: Steps (id s2), steps (id s3). Pass the id of the one meant");
  });

  it("counts a title and another's alias alike: ambiguous, not the title", () => {
    expect(matchLink(STAT, "rest", docs)).toEqual({
      problem: { kind: "ambiguous", label: "Stat", value: "rest", candidates: [{ id: "s5", title: "Sleep" }, { id: "s6", title: "Rest" }] },
    });
  });

  it("says each problem in words", () => {
    expect(linkProblemText({ kind: "unknown", label: "Person", value: "Bob" })).toBe("No Person called “Bob”");
  });
});

describe("list-of-links arguments: each entry by the same rule, every problem at once", () => {
  const WITH: CommandArg = { key: "with", label: "Person", kind: "links", linkType: "person" };
  const docs = [
    { id: "p1", type: "person", title: "Marc Lefèvre", aliases: ["Marco", "Marc"] },
    { id: "p2", type: "person", title: "Zoé Martin" },
    { id: "p3", type: "person", title: "Anne", aliases: ["Mum"] },
    { id: "p4", type: "person", title: "Anna", aliases: ["Mum"] },
    { id: "n1", type: "note", title: "Bob" },
  ];

  it("resolves each entry by id, title or alias, in the order given", () => {
    expect(pickLinks(WITH, ["zoe martin", "Marco"], docs)).toEqual(["p2", "p1"]);
    expect(pickLinks(WITH, ["p3"], docs)).toEqual(["p3"]);
  });

  it("names each Document once, where it first appears", () => {
    expect(pickLinks(WITH, ["Marc", "Zoé Martin", "Marco", "p1", "marc lefevre"], docs)).toEqual(["p1", "p2"]);
  });

  it("takes an empty list as none", () => {
    expect(pickLinks(WITH, [], docs)).toEqual([]);
  });

  it("collects every problem rather than stopping at the first", () => {
    expect(matchLinks(WITH, ["Bob", "Mum", "Marco"], docs)).toEqual({
      ids: ["p1"],
      problems: [
        { kind: "unknown", label: "Person", value: "Bob" },
        { kind: "ambiguous", label: "Person", value: "Mum", candidates: [{ id: "p3", title: "Anne" }, { id: "p4", title: "Anna" }] },
      ],
    });
  });

  it("refuses with all the problems in one message", () => {
    expect(() => pickLinks(WITH, ["Bob", "Mum", "Marco"], docs)).toThrow("No Person called “Bob”; “Mum” is more than one Person: Anne (id p3), Anna (id p4). Pass the id of the one meant");
  });
});

describe("reading a dialog's initial values", () => {
  const initial = { title: "call mum", n: "3.5", tags: ["a", "b"], one: "solo", none: undefined };

  it("reads text, empty when absent or not text", () => {
    expect(initialText(initial, "title")).toBe("call mum");
    expect(initialText(initial, "none")).toBe("");
    expect(initialText(undefined, "title")).toBe("");
    expect(initialText(initial, "tags")).toBe("");
  });

  it("reads a number from a number or text, undefined when it is not one", () => {
    expect(initialNumber(initial, "n")).toBe(3.5);
    expect(initialNumber({ n: 2 }, "n")).toBe(2);
    expect(initialNumber(initial, "title")).toBeUndefined();
    expect(initialNumber(undefined, "n")).toBeUndefined();
  });

  it("reads a moment from a day and an optional time", () => {
    expect(initialMoment({ date: "2026-10-24", time: "17:00" })).toBe("2026-10-24T17:00");
    expect(initialMoment({ date: "2026-10-24" })).toBe("2026-10-24T12:00");
    expect(initialMoment({ time: "17:00" })).toBeUndefined();
  });

  it("reads a list, wrapping a single value", () => {
    expect(initialList(initial, "tags")).toEqual(["a", "b"]);
    expect(initialList(initial, "one")).toEqual(["solo"]);
    expect(initialList(initial, "none")).toEqual([]);
  });
});

describe("commandRun", () => {
  const headless: CommandDef = { id: "x", title: "X", args: [], invoke: async () => ({ message: "ok" }) };

  it("reads a headless Command as headless", () => {
    expect(commandRun(headless)).toBe("headless");
  });

  it("gives a read-only Command no way to be picked: it answers an agent, in data the palette, a key or a Macro would drop (ADR 0115)", () => {
    expect(commandRun({ ...headless, readOnly: true })).toBe("none");
  });
});
