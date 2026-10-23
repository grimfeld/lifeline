import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { BUILTIN_MACROS, ensureBuiltinMacros, resetMacro, type BuiltinMacro } from "./builtinMacros";
import { db, MACROS, openDb } from "./data/db";
import { allMacros, deleteMacro, saveMacro, type MacroRecord } from "./macros";

/**
 * Built-in Macros (ADR 0092): given to each account once, as its own — to
 * edit, reset to how it shipped, or delete for good.
 */

const MORNING: BuiltinMacro = {
  builtin: "morning",
  name: "Morning",
  steps: [
    { command: "mood/mood.set", args: { mood: { from: "asked" } }, skipIfRefused: true },
    { command: "hub/hub.go-today", args: {} },
  ],
};

beforeEach(async () => {
  openDb([], []);
  await db().open();
  await db().collection(MACROS).clear();
});

describe("seeding the built-ins", () => {
  it("gives the account its morning Macro, carrying its built-in id", async () => {
    await ensureBuiltinMacros();
    const [morning] = await allMacros();
    expect(morning).toMatchObject({
      name: "Morning",
      builtin: "morning",
      steps: [
        { command: "mood/mood.set", args: { mood: { from: "asked" } }, skipIfRefused: true },
        { command: "hub/hub.go-today", args: {} },
      ],
    });
    expect(BUILTIN_MACROS.map((b) => b.builtin)).toEqual(["morning"]);
  });

  it("seeds once, however often it is asked, even at the same time", async () => {
    await Promise.all([ensureBuiltinMacros([MORNING]), ensureBuiltinMacros([MORNING])]);
    await ensureBuiltinMacros([MORNING]);
    expect((await allMacros()).map((m) => m.name)).toEqual(["Morning"]);
  });

  it("never brings back a built-in the user deleted", async () => {
    await ensureBuiltinMacros([MORNING]);
    await deleteMacro((await allMacros())[0]!.id);
    await ensureBuiltinMacros([MORNING]);
    expect(await allMacros()).toEqual([]);
  });

  it("never seeds one another device deleted, once that deletion has synced here", async () => {
    // What a pull leaves of a built-in deleted elsewhere: its tombstone.
    const tombstone: MacroRecord = { id: "elsewhere00000a", name: "Morning", builtin: "morning", steps: [], sort: 0, updatedAt: "2026-10-01T00:00:00.000Z", deleted: 1 };
    await db().collection<MacroRecord>(MACROS).put(tombstone);
    await ensureBuiltinMacros([MORNING]);
    expect(await allMacros()).toEqual([]);
  });

  it("leaves the user's copy alone when a later release changes the built-in", async () => {
    await ensureBuiltinMacros([MORNING]);
    const mine = (await allMacros())[0]!;
    await saveMacro({ id: mine.id, name: "My morning", steps: mine.steps.slice(0, 1) });
    await ensureBuiltinMacros([{ ...MORNING, name: "Morning (new)", steps: [] }]);
    expect(await allMacros()).toMatchObject([{ name: "My morning", builtin: "morning", steps: [{ command: "mood/mood.set" }] }]);
  });

  it("goes after the user's own Macros", async () => {
    await saveMacro({ name: "Coffee", steps: [] });
    await ensureBuiltinMacros([MORNING]);
    expect((await allMacros()).map((m) => m.name)).toEqual(["Coffee", "Morning"]);
  });
});

describe("reset to default", () => {
  it("restores the shipped name and steps, keeping the Macro and its place", async () => {
    await saveMacro({ name: "Coffee", steps: [] });
    await ensureBuiltinMacros([MORNING]);
    const mine = (await allMacros())[1]!;
    await saveMacro({ id: mine.id, name: "Late morning", steps: [] });
    await resetMacro(mine.id, [MORNING]);
    expect(await allMacros()).toMatchObject([{ name: "Coffee" }, { id: mine.id, name: "Morning", builtin: "morning", steps: MORNING.steps }]);
  });

  it("does nothing to a Macro that is no built-in", async () => {
    const coffee = await saveMacro({ name: "Coffee", steps: [] });
    expect(await resetMacro(coffee.id, [MORNING])).toBeUndefined();
    expect(await allMacros()).toMatchObject([{ name: "Coffee", steps: [] }]);
  });
});
