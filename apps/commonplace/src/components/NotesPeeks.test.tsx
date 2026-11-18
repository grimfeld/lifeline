// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { choose, fill, has, leave, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { commonplaceApp } from "../index";

/** The Notes App's Peeks write their own Fields (ADR 0085); a Quote's Source is guarded. */
peekTests([commonplaceApp]);

it("a Source's kind and author are edited in its Peek", async () => {
  const [id] = await peekNew({ type: "source", title: "A talk" });
  await choose("Kind", "Podcast");
  await fill("Author", "Ada");
  await press("Author", "Enter");
  expect(await stored(id!, "kind")).toBe("podcast");
  expect(await stored(id!, "author")).toBe("Ada");
});

it("a Quote's place is edited in its Peek; its Source is shown, never picked there", async () => {
  const ids = await peekNew({ type: "source", title: "A book" }, { type: "quote", body: "To be is to be perceived.\n", source: "$0", capturedOn: "2031-03-04" });
  await fill("Where", "p. 12");
  await leave("Where");
  expect(await stored(ids[1]!, "locator")).toBe("p. 12");
  expect(has("Source", "combobox")).toBe(false);
});
