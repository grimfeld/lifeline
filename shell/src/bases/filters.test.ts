import { describe, expect, it } from "vitest";
import type { DocumentTypeDef, FieldDef, ViewFilter } from "@lifeline/core";
import { describeFilter, draftFilter, filterableFields } from "./filters";

const status: FieldDef = { key: "status", label: "Status", kind: "select", options: [{ value: "read", label: "Read" }] };
const def: DocumentTypeDef = {
  id: "book", label: "Books", titleRule: "name", body: "optional", linkable: true, builtIn: true,
  fields: [status, { key: "raw", label: "Raw", kind: "json" }, { key: "secret", label: "Secret", kind: "text", hidden: true }, { key: "pages", label: "Pages", kind: "number" }],
};
const draft = (over: Partial<ViewFilter>): ViewFilter => ({ field: "title", op: "contains", value: "", ...over });

describe("filterableFields", () => {
  it("is the common fields but Updated, then the type's own but hidden and JSON ones", () => {
    expect(filterableFields(def).map((f) => f.key)).toEqual(["title", "tags", "folder", "createdAt", "status", "pages"]);
  });
});

describe("describeFilter", () => {
  it("names the field, the condition and the value, an option by its label", () => {
    expect(describeFilter({ field: "status", op: "eq", value: "read" }, def)).toBe("Status is Read");
    expect(describeFilter({ field: "tags", op: "anyOf", value: ["a", "b"] }, def)).toBe("Tags any of a, b");
  });

  it("leaves out the value of a condition that takes none", () => {
    expect(describeFilter({ field: "pages", op: "empty" }, def)).toBe("Pages is empty");
  });

  it("falls back to the raw key of a field the type no longer has", () => {
    expect(describeFilter({ field: "gone", op: "neq", value: 3 }, def)).toBe("gone is not 3");
  });
});

describe("draftFilter", () => {
  it("adds nothing while a value it needs is missing", () => {
    expect(draftFilter(draft({ value: "" }), undefined)).toBeNull();
    expect(draftFilter(draft({ value: undefined }), undefined)).toBeNull();
  });

  it("adds a condition that takes no value as it is", () => {
    expect(draftFilter(draft({ op: "empty", value: "" }), undefined)).toEqual({ field: "title", op: "empty", value: "" });
  });

  it("takes a value picked just now over the draft's", () => {
    expect(draftFilter(draft({ field: "createdAt", op: "gt", value: "" }), undefined, "2026-10-23")).toEqual({ field: "createdAt", op: "gt", value: "2026-10-23" });
  });

  it("reads any of as a list, a number field's value as a number, a yes/no as a boolean", () => {
    expect(draftFilter(draft({ op: "anyOf", value: " a, ,b " }), undefined)?.value).toEqual(["a", "b"]);
    expect(draftFilter(draft({ field: "pages", op: "gt", value: "12" }), def.fields[3])?.value).toBe(12);
    const yes: FieldDef = { key: "owned", label: "Owned", kind: "boolean" };
    expect(draftFilter(draft({ field: "owned", op: "eq", value: "true" }), yes)?.value).toBe(true);
    expect(draftFilter(draft({ field: "owned", op: "eq", value: "false" }), yes)?.value).toBe(false);
  });
});
