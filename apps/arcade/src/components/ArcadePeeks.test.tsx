// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { arcadeApp } from "../index";

/** The Arcade's Peek writes its own Fields (ADR 0085). */
peekTests([arcadeApp]);

it("a game's Year is edited in its Peek", async () => {
  const [id] = await peekNew({ type: "game", title: "Grim Fandango" });
  await fill("Year", "1998");
  expect(await stored(id!, "year")).toBe(1998);
});
