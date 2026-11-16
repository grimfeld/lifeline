import { describe, expect, it } from "vitest";
import { PERSON_TYPE } from "./people";
import { PLACE_TYPE, atTarget } from "./places";
import type { Document } from "./documents/types";

const doc = (over: Partial<Document>): Document => ({ id: "d1", type: PLACE_TYPE, title: "Chez Janou", folder: "", ...over }) as Document;

describe("atTarget", () => {
  it("returns a live Place or Person", () => {
    expect(atTarget(doc({}), "d1")).toEqual({ docId: "d1", title: "Chez Janou" });
    expect(atTarget(doc({ type: PERSON_TYPE, title: "Marc" }), "d1")).toEqual({ docId: "d1", title: "Marc" });
  });
  it("returns nothing for a deleted one, another type, or none", () => {
    expect(atTarget(doc({ deleted: 1 }), "d1")).toBeUndefined();
    expect(atTarget(doc({ type: "notes_note" }), "d1")).toBeUndefined();
    expect(atTarget(undefined, "d1")).toBeUndefined();
  });
});
