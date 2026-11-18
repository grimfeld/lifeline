// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { libraryApp } from "../index";

/** The Library's Peeks write their own Fields (ADR 0085); a book's Shelf moves are an e2e case (peek-culture.spec.ts). */
peekTests([libraryApp]);

it("an Author's dates are edited in its Peek", async () => {
  const [id] = await peekNew({ type: "author", title: "Ursula K. Le Guin" });
  await fill("Born", "1929");
  expect(await stored(id!, "born")).toBe("1929");
});
