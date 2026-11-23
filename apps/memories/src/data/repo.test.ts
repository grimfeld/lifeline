import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentsTable, getDocument, initApps } from "@lifeline/core";
import { memoryTypeDef } from "../types";
import { MEMORIES_FOLDER, MEMORY } from "../domain/types";
import { addMemory } from "./repo";

initApps([{ id: "memories", title: "Memories", module: "journal", types: [memoryTypeDef], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 23, 12) });
  await documentsTable().clear();
});
afterEach(() => vi.useRealTimers());

describe("adding a Memory (ADR 0136)", () => {
  it("takes a title alone: dated today, about nothing, in Memories", async () => {
    const m = await addMemory({ title: "  First snow " });
    expect(m).toMatchObject({ type: MEMORY, title: "First snow", folder: MEMORIES_FOLDER, date: "2026-11-23", about: [], body: "" });
    expect(await getDocument(m.id)).toMatchObject({ title: "First snow", date: "2026-11-23" });
  });

  it("keeps a date, what it is about, and its words", async () => {
    const m = await addMemory({ title: "Lunch at Janou", date: "2026-06-14", about: ["p1", "e1", "p1"], body: "We sat outside.  \n" });
    expect(m).toMatchObject({ date: "2026-06-14", about: ["p1", "e1"], body: "We sat outside.\n" });
  });

  it("refuses a Memory with no title", async () => {
    await expect(addMemory({ title: " " })).rejects.toThrow("A Memory needs a title");
  });

  it("numbers a title another Memory has, rather than failing", async () => {
    await addMemory({ title: "Birthday", date: "2025-03-02" });
    expect((await addMemory({ title: "birthday" })).title).toBe("birthday (2)");
  });
});
