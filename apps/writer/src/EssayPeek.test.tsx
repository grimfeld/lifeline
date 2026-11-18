// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { choose, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { writerApp } from "./index";

/** The Research App's Peek writes an Essay's own Fields (ADR 0085). */
peekTests([writerApp]);

it("an Essay's status is set in its Peek", async () => {
  const [id] = await peekNew({ type: "essay", title: "On peeking", status: "draft", material: [] });
  await choose("Status", "Revised");
  expect(await stored(id!, "status")).toBe("revised");
});
