import { describe, expect, it } from "vitest";
import type { Document, FieldDef } from "@lifeline/core";
import { boardColumns, byDayOf, geoOf, monthGrid } from "./layouts";

const doc = (id: string, extra: Partial<Document> = {}): Document => ({ id, type: "book", title: id, folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra });
const ids = (docs: Document[] | undefined) => (docs ?? []).map((d) => d.id);

describe("geoOf", () => {
  const at: FieldDef = { key: "at", label: "At", kind: "geo" };
  it("is the field's latitude and longitude", () => {
    expect(geoOf(doc("a", { at: [50.06, 19.94] }), at)).toEqual([50.06, 19.94]);
  });

  it("is null with no field, no value, or one that is not two finite numbers", () => {
    expect(geoOf(doc("a", { at: [50, 19] }), undefined)).toBeNull();
    for (const v of [undefined, "50,19", [50], ["50", "19"], [NaN, 19], [50, Infinity]]) expect(geoOf(doc("a", { at: v }), at)).toBeNull();
  });
});

describe("boardColumns", () => {
  const status: FieldDef = { key: "status", label: "Status", kind: "select", options: [{ value: "todo", label: "To do" }, { value: "done", label: "Done" }] };

  it("has a column per option in its order, each holding its Documents", () => {
    const { columns, byValue } = boardColumns([doc("a", { status: "done" }), doc("b", { status: "todo" }), doc("c", { status: "done" })], status);
    expect(columns).toEqual([{ value: "todo", label: "To do" }, { value: "done", label: "Done" }]);
    expect(ids(byValue.get("done"))).toEqual(["a", "c"]);
    expect(ids(byValue.get("todo"))).toEqual(["b"]);
  });

  it("gathers the Documents with no option, or one no longer offered, under a last “—”", () => {
    const { columns, byValue } = boardColumns([doc("a"), doc("b", { status: "archived" })], status);
    expect(columns.at(-1)).toEqual({ value: "", label: "—" });
    expect(ids(byValue.get(""))).toEqual(["a", "b"]);
  });
});

describe("byDayOf", () => {
  const due: FieldDef = { key: "due", label: "Due", kind: "datetime" };
  it("puts each Document on the day its field holds, a datetime by its day", () => {
    const { byDay, omitted, placed } = byDayOf([doc("a", { due: "2026-10-23T09:00" }), doc("b", { due: "2026-10-23" }), doc("c", { due: "" }), doc("d", { due: "soon" })], due);
    expect(ids(byDay.get("2026-10-23"))).toEqual(["a", "b"]);
    expect(placed).toBe(2);
    expect(ids(omitted)).toEqual(["c", "d"]);
  });

  it("omits everything with no field", () => {
    expect(byDayOf([doc("a")], undefined).placed).toBe(0);
  });
});

describe("monthGrid", () => {
  it("starts on the Monday on or before the 1st and runs five weeks when that holds the month", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const days = monthGrid(2026, 10);
    expect(days[0]).toBe("2026-09-28");
    expect(days).toHaveLength(35);
    expect(days.at(-1)).toBe("2026-11-01");
  });

  it("runs a sixth week when the month reaches into it", () => {
    // August 2026 starts on a Saturday: the 31st is a Monday in the sixth row.
    const days = monthGrid(2026, 8);
    expect(days[0]).toBe("2026-07-27");
    expect(days).toHaveLength(42);
    expect(days).toContain("2026-08-31");
  });
});
