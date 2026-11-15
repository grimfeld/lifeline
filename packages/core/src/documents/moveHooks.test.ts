import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { ATTACHMENTS, db, type SyncedRecord } from "../data/db";
import { put } from "../data/repo";
import { initApps } from "../registry";
import { documentsTable, moveDocumentsToWorkspace, putDocument } from "./store";
import type { Document, DocumentTypeDef } from "./types";

const seen: string[] = [];
const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({ id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra });
const types = [
  T("calm", { onMove: async (doc: Document, ws: string) => void seen.push(`${doc.id}->${ws}`) }),
  T("cross", {
    onMove: async () => {
      throw new Error("hook failed");
    },
  }),
];
initApps([{ id: "t", title: "T", types, screens: [], cards: [], commands: [] }]);

type AttachmentRow = SyncedRecord & { name: string; workspace?: string };
const attachment = (id: string) => db().collection<AttachmentRow>(ATTACHMENTS).get(id);

beforeEach(async () => {
  seen.length = 0;
  await documentsTable().clear();
  await db().collection(ATTACHMENTS).clear();
});

describe("a type's move hook (ADR 0048)", () => {
  it("runs for each moved Document, in its new Workspace", async () => {
    await putDocument({ id: "a", type: "calm", title: "A" });
    await moveDocumentsToWorkspace(["a"], "w1");
    expect(seen).toEqual(["a->w1"]);
  });

  it("cannot split a Document from its attachments: when it throws, the attachments have moved too", async () => {
    await put<AttachmentRow>(ATTACHMENTS, { id: "att", name: "photo.png" });
    await putDocument({ id: "x", type: "cross", title: "X", body: "![[photo.png]]" });
    await expect(moveDocumentsToWorkspace(["x"], "w1")).rejects.toThrow("hook failed");
    expect((await documentsTable().get("x"))?.workspace).toBe("w1");
    expect((await attachment("att"))?.workspace).toBe("w1");
  });

  it("runs every other Document's hook when one throws", async () => {
    await putDocument({ id: "x", type: "cross", title: "X" });
    await putDocument({ id: "a", type: "calm", title: "A" });
    await expect(moveDocumentsToWorkspace(["x", "a"], "w1")).rejects.toThrow("hook failed");
    expect(seen).toEqual(["a->w1"]);
  });
});
