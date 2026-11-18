// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { click, control, fill, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { cinemaApp } from "../index";

/** The Cinema's Peeks write their own Fields (ADR 0085). */
peekTests([cinemaApp]);

it("a film's Reason is edited in its Peek, and it is liked there", async () => {
  const [id] = await peekNew({ type: "movie", title: "Heat" });
  await fill("Reason", "A friend swore by it");
  expect(await stored(id!, "reason")).toBe("A friend swore by it");
  await click(control("Like", "button"));
  expect(await stored(id!, "liked")).toBe(true);
});

it("a Playlist is ranked from its Peek", async () => {
  const [id] = await peekNew({ type: "cinema_playlist", title: "Heists", workIds: [], ranked: false });
  await click(control("Ranked", "checkbox"));
  expect(await stored(id!, "ranked")).toBe(true);
});
