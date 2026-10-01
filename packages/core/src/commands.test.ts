import { describe, expect, it } from "vitest";
import { invokeCommand, readCommandArgs } from "./commands";
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

describe("invokeCommand", () => {
  it("passes checked arguments to the App's invoke", async () => {
    const def: CommandDef = { id: "t.add", title: "Add", args: ARGS, invoke: async (a) => ({ message: `added ${a.title}` }) };
    expect(await invokeCommand(def, { title: "Gym" })).toEqual({ message: "added Gym" });
  });

  it("refuses a Command that has only a dialog", async () => {
    await expect(invokeCommand({ id: "t.x", title: "Dialog only" }, {})).rejects.toThrow("cannot be run without its dialog");
  });
});
