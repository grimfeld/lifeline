// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { knowledgeApp } from "../index";

/** The Knowledge App's Peeks write their own Fields through its operations (ADR 0085). */
peekTests([knowledgeApp]);

it("a Word's meaning is edited in its Peek", async () => {
  const ids = await peekNew(
    { type: "language", name: "Spanish", newCap: 10, archived: false },
    { type: "language_word", languageId: "$0", term: "ganas", meaning: "desire", notes: "", origin: "", originId: "", paused: false },
  );
  await fill("Meaning", "to feel like");
  await press("Meaning", "Enter");
  expect(await stored(ids[1]!, "meaning")).toBe("to feel like");
});
