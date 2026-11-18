import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "../registry";
import { documentsTable, getDocument, putDocuments, removeDocument } from "./store";
import type { DocumentTypeDef } from "./types";

const note: DocumentTypeDef = { id: "note", label: "Notes", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true };
initApps([{ id: "t", title: "T", types: [note], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("putDocuments", () => {
  it("writes each Document as putDocument would: an id, its Tags from the body, kept fields", async () => {
    const [a, b] = await putDocuments([
      { id: "a", type: "note", title: "One", body: "about #garden" },
      { type: "note", title: "Two", tags: ["Work"] },
    ]);
    expect(await getDocument("a")).toMatchObject({ title: "One", tags: ["garden"] });
    expect(b?.id).toBeTruthy();
    expect(await getDocument(b!.id)).toMatchObject({ title: "Two", tags: ["work"] });
    expect(a?.id).toBe("a");
  });

  it("writes all or none: one row the store refuses leaves every other unwritten", async () => {
    await expect(putDocuments([{ id: "a", type: "note", title: "One" }, { id: {} as unknown as string, type: "note", title: "Bad" }])).rejects.toThrow();
    expect(await getDocument("a")).toBeUndefined();
  });

  it("patches: only the named fields, onto the row as it is when the write lands, in the same all-or-none write", async () => {
    await putDocuments([{ id: "p", type: "note", title: "Plan", body: "x", day: "mon" }]);
    await putDocuments([{ id: "q", type: "note", title: "Other" }], [{ id: "p", patch: { day: "tue" } }]);
    expect(await getDocument("p")).toMatchObject({ title: "Plan", body: "x", day: "tue" });
    expect(await getDocument("q")).toMatchObject({ title: "Other" });
  });

  it("skips a patch whose Document is gone: a patch never brings a deleted row back", async () => {
    await putDocuments([{ id: "p", type: "note", title: "Plan" }]);
    await removeDocument("p");
    await putDocuments([], [{ id: "p", patch: { day: "tue" } }, { id: "nope", patch: { day: "tue" } }]);
    expect(await documentsTable().get("p")).toMatchObject({ deleted: 1 });
    expect(await documentsTable().get("nope")).toBeUndefined();
  });

  it("keeps a patch's row unwritten when another row in the write is refused", async () => {
    await putDocuments([{ id: "p", type: "note", title: "Plan", day: "mon" }]);
    await expect(putDocuments([{ id: {} as unknown as string, type: "note", title: "Bad" }], [{ id: "p", patch: { day: "tue" } }])).rejects.toThrow();
    expect(await getDocument("p")).toMatchObject({ day: "mon" });
  });
});
