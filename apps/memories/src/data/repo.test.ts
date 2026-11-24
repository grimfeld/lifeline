import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentsTable, getDocument, initApps } from "@lifeline/core";
import { memoryTypeDef } from "../types";
import { MEMORIES_FOLDER, MEMORY } from "../domain/types";
import { addMemory, deleteMemory, patchMemory, restoreMemory } from "./repo";

const addAttachment = vi.hoisted(() => vi.fn(async (_f: Blob) => ({ name: "Pasted image 1.jpg" })));
vi.mock("@lifeline/core", async (orig) => ({ ...(await orig<typeof import("@lifeline/core")>()), addAttachment }));

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

  it("embeds a photo by name after the words, as Attachments are embedded", async () => {
    const photo = new File(["x"], "terrace.jpg", { type: "image/jpeg" });
    const m = await addMemory({ title: "Terrace", body: "Warm night.", photo });
    expect(addAttachment).toHaveBeenCalledWith(photo);
    expect(m.body).toBe("Warm night.\n\n![[Pasted image 1.jpg]]\n");
    expect((await addMemory({ title: "Bare", photo })).body).toBe("![[Pasted image 1.jpg]]\n");
  });

  it("makes no Memory when the photo is refused", async () => {
    addAttachment.mockRejectedValueOnce(new Error("File is too big (25 MB; the limit is 20 MB)"));
    await expect(addMemory({ title: "Huge", photo: new File(["x"], "h.jpg", { type: "image/jpeg" }) })).rejects.toThrow("too big");
    expect(await documentsTable().count()).toBe(0);
  });
});

describe("changing a Memory", () => {
  it("renames, redates and re-points it, only what is patched", async () => {
    const m = await addMemory({ title: "Lunch", date: "2026-06-14", about: ["p1"] });
    await patchMemory(m.id, { title: "Lunch at Janou" });
    await patchMemory(m.id, { date: "2026-06-15", about: ["p2", "p2"] });
    expect(await getDocument(m.id)).toMatchObject({ title: "Lunch at Janou", date: "2026-06-15", about: ["p2"] });
  });

  it("refuses an empty title", async () => {
    const m = await addMemory({ title: "Lunch" });
    await expect(patchMemory(m.id, { title: " " })).rejects.toThrow("A Memory needs a title");
  });
});

describe("deleting a Memory", () => {
  it("is undone: the same Memory comes back, as it was", async () => {
    const m = await addMemory({ title: "First snow", date: "2026-01-04", about: ["p1"], body: "Cold.\n" });
    const gone = await deleteMemory(m.id);
    expect(await getDocument(m.id)).toBeUndefined();
    await restoreMemory(gone!);
    expect(await getDocument(m.id)).toMatchObject({ id: m.id, title: "First snow", date: "2026-01-04", about: ["p1"], body: "Cold.\n", deleted: 0 });
  });
});
