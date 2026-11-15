import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "../registry";
import { documentsTable, getDocument, putDocuments } from "./store";
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
});
