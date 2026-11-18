// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, leave, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { workoutApp } from "../index";

/** The Workout App's Peek writes its own Fields through its operations (ADR 0085). */
peekTests([workoutApp]);

it("a Session's notes are edited in its Peek", async () => {
  const ids = await peekNew(
    { type: "workout", title: "Fran", blocks: [], tallies: [] },
    { type: "workout_session", title: "Fran · 2026-10-01", workoutId: "$0", startedAt: "2026-10-01T08:00:00.000Z", endedAt: "2026-10-01T08:20:00.000Z", date: "2026-10-01", start: "08:00", end: "08:20", durationMin: 20, results: [], notes: "" },
  );
  await fill("Notes", "Felt strong");
  // Written on leaving the field (Escape in it would put the stored value back).
  await leave("Notes");
  expect(await stored(ids[1]!, "notes")).toBe("Felt strong");
});
