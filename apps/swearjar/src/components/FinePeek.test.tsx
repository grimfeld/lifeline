// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { expect, it } from "vitest";
import { fill, has, leave, peekNew, peekTests, press, stored } from "@lifeline/parts/testing";
import { swearjarApp } from "../index";

/** The Swear Jar's Peek writes a Fine's own Fields through its operations (ADR 0085). */
peekTests([swearjarApp]);

const fine = () =>
  peekNew(
    { type: "swearjar_offence", title: "Snoozed", name: "Snoozed", price: 200, emoji: "", color: "", archived: false },
    { type: "swearjar_fine", title: "€2.00", offenceId: "$0", amount: 200, occurredAt: "2026-10-01T08:00:00.000Z", note: "" },
  ).then((ids) => ids[1]!);

it("a Fine's note is edited in its Peek; its amount stays the Offence's", async () => {
  const id = await fine();
  expect(has("Amount (cents)")).toBe(false);
  await fill("Note", "Twice, really");
  // Written on leaving the field (Escape in it would put the stored value back).
  await leave("Note");
  expect(await stored(id, "note")).toBe("Twice, really");
  expect(await stored(id, "amount")).toBe(200);
});

it("a Fine's time is typed into its Peek's Time field and written at once", async () => {
  const id = await fine();
  expect(document.querySelector('input[type="time"]'), "no native time input").toBeNull();
  await fill("Time", "7:45pm");
  await press("Time", "Enter");
  const at = new Date(String(await stored(id, "occurredAt")));
  expect(`${at.getHours()}:${at.getMinutes()}`).toBe("19:45");
});
