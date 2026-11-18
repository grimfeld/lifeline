// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { click, control, fill, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { museumApp } from "../index";

/** The Museum's Peek writes its own Fields (ADR 0085). */
peekTests([museumApp]);

it("a painting's Location is edited in its Peek, and it is marked seen there", async () => {
  const [id] = await peekNew({ type: "painting", title: "The Raft of the Medusa" });
  await fill("Location", "Louvre, Paris");
  expect(await stored(id!, "location")).toBe("Louvre, Paris");
  await click(control("Seen in person", "checkbox"));
  expect(await stored(id!, "seen")).toBe(true);
});
