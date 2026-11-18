// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { discothequeApp } from "../index";

/** The Discotheque's Peeks write their own Fields (ADR 0085). */
peekTests([discothequeApp]);

it("an album's Artist is edited in its Peek", async () => {
  const [id] = await peekNew({ type: "music", title: "Pastel Blues" });
  await fill("Artist", "Nina Simone");
  expect(await stored(id!, "creator")).toBe("Nina Simone");
});
