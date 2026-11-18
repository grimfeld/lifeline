import { describe, expect, it } from "vitest";
import { contactsTimed } from "./timed";
import type { TimedItem } from "@lifeline/core";

describe("contactsTimed.peekOf (#538)", () => {
  it("peeks the Person whose Occasion was tapped", () => {
    const item = { key: "contacts/p1:o1@2026-11-10", appId: "contacts", itemId: "p1:o1@2026-11-10", title: "Ana's birthday", date: "2026-11-10", start: null, end: null, marker: true, occasion: true, docId: "p1" } as TimedItem;
    expect(contactsTimed.peekOf!(item)).toBe("p1");
  });
});
