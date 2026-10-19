import { describe, expect, it } from "vitest";
import { defaultTemplateFor, planFolderRename, templateStartsFor, templatesFor } from "./ops";
import type { Document, DocumentTypeDef } from "./types";

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

describe("templateStartsFor (an empty body in a Peek, ADR 0085)", () => {
  const body = (id: string, title: string, text: string, forType: string): Document => ({ ...tpl(id, title, forType), body: text }) as Document;
  const marie = { id: "m", type: "person", title: "Marie", body: "", tags: [] } as unknown as Document;
  const person = { id: "person", label: "People", builtIn: false } as unknown as DocumentTypeDef;
  const now = new Date(2026, 9, 19, 9, 5);

  it("offers each of the type's Templates, filled for this Document", () => {
    const docs = [body("a", "Friend", "# {{title}}\nMet on {{date}} at {{time}}", "person"), body("b", "Colleague", "Works at", "person"), body("c", "Meeting", "x", "note")];
    expect(templateStartsFor(marie, person, docs, now)).toEqual([
      { id: "a", title: "Friend", body: "# Marie\nMet on 2026-10-19 at 09:05" },
      { id: "b", title: "Colleague", body: "Works at" },
    ]);
  });

  it("dates a Day's Template by the Day itself", () => {
    const day = { id: "d", type: "daily", title: "2026-03-01", body: "", tags: [] } as unknown as Document;
    const daily = { id: "daily", label: "Days", builtIn: true, titleRule: "date" } as unknown as DocumentTypeDef;
    expect(templateStartsFor(day, daily, [body("a", "Gratitude", "{{date}}", "daily")], now)).toEqual([{ id: "a", title: "Gratitude", body: "2026-03-01" }]);
  });

  it("offers a built-in's own default only when it has no Templates, and nothing for a user type without any", () => {
    const note = { id: "c", type: "note", title: "Idea", body: "", tags: [] } as unknown as Document;
    const noteDef = { id: "note", label: "Notes", builtIn: true, template: "## {{title}}" } as unknown as DocumentTypeDef;
    expect(templateStartsFor(note, noteDef, [], now)).toEqual([{ id: "", title: "Default", body: "## Idea" }]);
    expect(templateStartsFor(note, noteDef, [body("t", "Meeting", "Agenda", "note")], now)).toEqual([{ id: "t", title: "Meeting", body: "Agenda" }]);
    expect(templateStartsFor(marie, person, [], now)).toEqual([]);
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
