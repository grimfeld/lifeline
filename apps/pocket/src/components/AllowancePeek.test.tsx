// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, leave, peekNew, peekTests, stored } from "@lifeline/parts/testing";
import { pocketApp } from "../index";

/** The Pocket's Peek writes its own Fields through its operations (ADR 0085). */
peekTests([pocketApp]);

it("an Allowance's name is edited in its Peek, and its title follows", async () => {
  const [id] = await peekNew({ type: "pocket_allowance", name: "Eating out", period: "month", from: "2026-10-01", to: "", amount: 30000, emoji: "", color: "" });
  await fill("Name", "Cinema");
  await leave("Name");
  expect(await stored(id!, "name")).toBe("Cinema");
  expect(await stored(id!, "title")).toContain("Cinema");
});
