// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { choose, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { thoughtsApp } from "../index";

/** The Thoughts App's Peek writes a Thought's own Fields (ADR 0085). */
peekTests([thoughtsApp]);

it("a Thought's kind is set in its Peek", async () => {
  const [id] = await peekNew({ type: "thought", title: "Why peek", body: "Hm.\n" });
  await choose("Kind", "Question");
  expect(await stored(id!, "kind")).toBe("question");
});
