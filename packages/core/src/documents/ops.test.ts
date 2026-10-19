import { describe, expect, it } from "vitest";
import { defaultTemplateFor, templatesFor } from "./ops";
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
