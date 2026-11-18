// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { click, control, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { moodApp } from "../index";

/** The Mood App's Peek writes its own Field through its operations (ADR 0085). */
peekTests([moodApp]);

it("a day's Mood is changed in its Peek", async () => {
  const [id] = await peekNew({ type: "mood", title: "2020-01-01", level: 2 });
  await click(control(/Great/, "button"));
  expect(await stored(id!, "level")).toBe(5);
});
