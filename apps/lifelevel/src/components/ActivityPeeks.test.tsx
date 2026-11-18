// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { choose, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { lifelevelApp } from "../index";

/** Life Level's Peeks write their own Fields through its operations (ADR 0085). */
peekTests([lifelevelApp]);

it("a Habit's difficulty is changed in its Peek", async () => {
  const [id] = await peekNew({ type: "habit", title: "Read", difficulty: "normal" });
  await choose("Difficulty", /^Hard/);
  expect(await stored(id!, "difficulty")).toBe("hard");
});
