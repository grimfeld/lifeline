import { describe, expect, it } from "vitest";
import { ADD_FIELD_KINDS } from "./addFieldMenu";
import type { DocumentTypeDef, FieldKind } from "./types";
import { layoutFieldCandidates } from "./views";

/** A type with one Field of `kind` (a plain key — no cover-ish name). */
const typeWith = (kind: FieldKind) => ({ id: "t", label: "T", fields: [{ key: "f", label: "F", kind }] }) as unknown as DocumentTypeDef;
const noteOf = (kind: FieldKind) => ADD_FIELD_KINDS.find((c) => c.kind === kind)!.note;

describe("The + Field menu's plain kinds", () => {
  it("lists every kind once, in the Kind dropdown's order, by its label", () => {
    expect(ADD_FIELD_KINDS.map((c) => c.kind)).toEqual(["text", "longtext", "number", "boolean", "date", "datetime", "select", "multiselect", "url", "geo", "list", "link", "links"]);
    expect(ADD_FIELD_KINDS.find((c) => c.kind === "select")?.label).toBe("Choice");
    expect(ADD_FIELD_KINDS.every((c) => c.note.length > 0)).toBe(true);
  });

  it("says a kind adds a board, map, gallery or calendar layout exactly when its Base offers one by it", () => {
    for (const { kind, note } of ADD_FIELD_KINDS) {
      const own = (layout: "board" | "map" | "gallery" | "calendar") => layoutFieldCandidates(typeWith(kind), layout).some((f) => f.key === "f");
      expect([kind, /board/.test(note), /map layout/.test(note), /gallery/.test(note), /calendar/.test(note)]).toEqual([kind, own("board"), own("map"), own("gallery"), own("calendar")]);
    }
  });

  it("tells a date Field it is not the Calendar app", () => {
    expect(noteOf("date")).toMatch(/not the Calendar app/);
    expect(noteOf("datetime")).toMatch(/not the Calendar app/);
  });

  it("says a Link makes backlinks and Graph edges", () => {
    for (const k of ["link", "links"] as const) expect(noteOf(k)).toMatch(/backlink.*Graph/i);
  });
});
