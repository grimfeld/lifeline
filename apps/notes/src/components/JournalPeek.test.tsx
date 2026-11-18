// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { notesApp } from "../index";

/** The Journal's Peek writes a Day's own Fields (ADR 0085). */
peekTests([notesApp]);

it("a Day's Tags are edited in its Peek", async () => {
  const [id] = await peekNew({ type: "daily", title: "2031-03-04", body: "A day with #walk in it.\n" });
  await fill("Tags", "seaside");
  await press("Tags", "Enter");
  expect(await stored(id!, "tags")).toEqual(expect.arrayContaining(["seaside"]));
});
