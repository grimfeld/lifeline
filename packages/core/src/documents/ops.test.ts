import { describe, expect, it } from "vitest";
import { planFolderRename } from "./ops";
import type { Document } from "./types";

const doc = (id: string, folder: string, body?: string): Document =>
  ({ id, type: "note", title: id, folder, tags: [], body, updatedAt: "", deleted: 0 }) as unknown as Document;

describe("planFolderRename (CR-02)", () => {
  it("writes each Document once, keeping sibling moves and every link rewrite", () => {
    const docs = [
      doc("A", "f", "see [[f/B]]"),
      doc("B", "f/sub", "see [[f/A]]"),
      doc("C", "", "[[f/A]] and [[f/sub/B|bee]]"),
      doc("D", "other", "nothing here"),
    ];
    const rows = planFolderRename(docs, "f", "g");
    expect(rows.map((r) => r.id).sort()).toEqual(["A", "B", "C"]);
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get("A")).toMatchObject({ folder: "g", body: "see [[f/B]]" });
    expect(byId.get("B")).toMatchObject({ folder: "g/sub", body: "see [[g/A]]" });
    expect(byId.get("C")).toMatchObject({ folder: "", body: "[[g/A]] and [[g/sub/B|bee]]" });
  });

  it("leaves a body-less Document's body alone", () => {
    const rows = planFolderRename([doc("A", "f")], "f", "g");
    expect(rows).toHaveLength(1);
    expect(rows[0].folder).toBe("g");
    expect(rows[0].body).toBeUndefined();
  });
});
