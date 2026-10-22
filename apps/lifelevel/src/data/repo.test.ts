// @vitest-environment jsdom
// The App's index pulls in its screens, which need a DOM.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, removeDocument } from "@lifeline/core";
import { lifelevelApp } from "../index";
import { computeProgression } from "../domain/progression";
import type { HabitCompletion, NegativeCompletion } from "../domain/types";
import { addHabit, addNegative, allHabits, allNegatives, completeHabit, deleteHabit, deleteNegative, logNegative } from "./repo";

initApps([lifelevelApp]);

beforeEach(async () => {
  await documentsTable().clear();
});

const habit = (title: string) => addHabit({ title, difficulty: "easy", tags: [] });
const fixedNegative = (title: string, affectsHabitId: string) => addNegative({ title, gravity: "minor", affectsHabitId, tags: [] });

/** The ledger's rows and everything derived from them, as the App reads them. */
async function snapshot() {
  const [habits, negatives, hc, nc] = await Promise.all([
    allHabits(),
    allNegatives(),
    documentsOf<HabitCompletion>("habit_completion"),
    documentsOf<NegativeCompletion>("negative_completion"),
  ]);
  const derived = computeProgression(habits, negatives, hc, nc, new Date());
  return { hc, nc, habits: derived.habits.map((h) => [h.habitId, h.level, h.completionCount]) };
}

describe("deleting a Habit through removeDocument (ADR 0026)", () => {
  it("takes its own Completions and every Negative Completion that hit it, and leaves the rest", async () => {
    const run = await habit("Run");
    const read = await habit("Read");
    const slip = await fixedNegative("Slip", run);
    const doom = await fixedNegative("Doomscroll", read);
    await completeHabit(run);
    await completeHabit(read);
    await logNegative(slip);
    await logNegative(doom);

    await removeDocument(run); // a Base's bulk delete or the Vault's, not the App's own

    const { hc, nc } = await snapshot();
    expect(hc.map((c) => c.habitId)).toEqual([read]);
    expect(nc.map((c) => c.affectedHabitId)).toEqual([read]);
  });
});

describe("deleting a Negative through removeDocument (ADR 0026)", () => {
  it("takes its own Completions and leaves other Negatives' alone", async () => {
    const run = await habit("Run");
    const slip = await fixedNegative("Slip", run);
    const doom = await fixedNegative("Doomscroll", run);
    await logNegative(slip);
    await logNegative(doom);

    await removeDocument(slip);

    const { nc } = await snapshot();
    expect(nc.map((c) => c.negativeId)).toEqual([doom]);
  });
});

describe("the App's own delete", () => {
  async function seed() {
    const run = await habit("Run");
    const read = await habit("Read");
    const slip = await fixedNegative("Slip", run);
    for (const id of [run, run, read]) await completeHabit(id);
    await logNegative(slip);
    return { run, slip };
  }

  it("derives the same levels and debt as the generic delete", async () => {
    let seeded = await seed();
    await deleteHabit(seeded.run);
    await deleteNegative(seeded.slip);
    const viaApp = await snapshot();

    await documentsTable().clear();
    seeded = await seed();
    await removeDocument(seeded.run);
    await removeDocument(seeded.slip);
    const viaCore = await snapshot();

    // Ids differ between the two seeds; compare the shape of what is left.
    expect(viaCore.hc.length).toBe(viaApp.hc.length);
    expect(viaCore.nc.length).toBe(viaApp.nc.length);
    expect(viaCore.habits.map(([, level, count]) => [level, count])).toEqual(viaApp.habits.map(([, level, count]) => [level, count]));
    expect(viaCore.hc).toHaveLength(1);
    expect(viaCore.nc).toHaveLength(0);
  });
});
