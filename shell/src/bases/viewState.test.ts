import { describe, expect, it } from "vitest";
import type { DocumentTypeDef, ViewRecord } from "@lifeline/core";
import { sortedBy, stateOf, withColumnToggled } from "./viewState";

const def: DocumentTypeDef = { id: "book", label: "Books", titleRule: "name", body: "optional", linkable: true, builtIn: true, fields: [{ key: "author", label: "Author", kind: "text" }] };

describe("stateOf", () => {
  it("is All with no View: last updated first, the type's default columns, a table", () => {
    expect(stateOf(undefined, def)).toEqual({
      filters: [], search: "", sortBy: "updatedAt", sortDir: "desc", columns: ["title", "author", "tags"], layout: "table",
      imageField: undefined, geoField: undefined, groupField: undefined, dateField: undefined,
    });
  });

  it("is what the View saved", () => {
    const v = { id: "v", type: "book", name: "Read", sort: 0, filters: [{ field: "status", op: "eq", value: "read" }], search: "x", sortBy: "title", sortDir: "asc", columns: ["title"], layout: "board", groupField: "status", updatedAt: "", deleted: 0 } as ViewRecord;
    expect(stateOf(v, def)).toMatchObject({ filters: v.filters, search: "x", sortBy: "title", sortDir: "asc", columns: ["title"], layout: "board", groupField: "status" });
  });
});

describe("sortedBy", () => {
  const s = stateOf(undefined, def);
  it("turns the sorted column round", () => {
    expect(sortedBy(s, "updatedAt").sortDir).toBe("asc");
    expect(sortedBy(sortedBy(s, "updatedAt"), "updatedAt").sortDir).toBe("desc");
  });

  it("sorts another column ascending", () => {
    expect(sortedBy(s, "title")).toMatchObject({ sortBy: "title", sortDir: "asc" });
  });
});

describe("withColumnToggled", () => {
  const s = stateOf(undefined, def);
  it("hides a shown column and shows a hidden one last", () => {
    expect(withColumnToggled(s, "author").columns).toEqual(["title", "tags"]);
    expect(withColumnToggled(s, "folder").columns).toEqual(["title", "author", "tags", "folder"]);
  });
});
