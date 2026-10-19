import { describe, expect, it } from "vitest";
import { defaultTemplateFor, onlyTemplateFor, planFolderRename, templatesFor } from "./ops";
import type { Document } from "./types";

const tpl = (id: string, title: string, forType?: string): Document =>
  ({ id, type: "template", title, body: `# ${title}`, tags: [], folder: "Templates", createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...(forType ? { forType } : {}) }) as Document;

describe("templatesFor", () => {
  const docs = [tpl("a", "daily"), tpl("b", "Gratitude day", "daily"), tpl("c", "Meeting", "note"), tpl("d", "week")];

  it("is every Template made for the type, the old title-named one included", () => {
    expect(templatesFor("daily", docs).map((d) => d.id)).toEqual(["a", "b"]);
    expect(templatesFor("note", docs).map((d) => d.id)).toEqual(["c"]);
    expect(templatesFor("person", docs)).toEqual([]);
  });

  it("defaults to the one titled by the type id, else the only one, else none", () => {
    expect(defaultTemplateFor("daily", docs)?.id).toBe("a");
    expect(defaultTemplateFor("note", docs)?.id).toBe("c");
    expect(defaultTemplateFor("daily", [tpl("b", "Gratitude day", "daily"), tpl("e", "Short day", "daily")])).toBeUndefined();
  });
});

describe("onlyTemplateFor (quick make)", () => {
  it("is the type's Template when it has exactly one, and none when it has several or none", () => {
    expect(onlyTemplateFor("person", [tpl("p", "Someone", "person"), tpl("c", "Meeting", "note")])?.id).toBe("p");
    // Even one titled by the type id is not picked over another: quick make asks nothing, so it takes no side.
    expect(onlyTemplateFor("daily", [tpl("a", "daily"), tpl("b", "Gratitude day", "daily")])).toBeUndefined();
    expect(onlyTemplateFor("place", [tpl("c", "Meeting", "note")])).toBeUndefined();
  });
});

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
