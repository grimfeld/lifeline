// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { projectsApp } from "../index";

/** The Projects App's Peek writes its own Fields through its operations (ADR 0085). */
peekTests([projectsApp]);

it("a Project's outcome is edited in its Peek", async () => {
  const [id] = await peekNew({ type: "project", title: "Bathroom", outcome: "", stage: "active", start: null, deadline: null, startedOn: null, endedOn: null, emoji: "", color: "", rank: null });
  await fill("Outcome", "New tiles, no leak");
  await press("Outcome", "Enter");
  expect(await stored(id!, "outcome")).toBe("New tiles, no leak");
});
