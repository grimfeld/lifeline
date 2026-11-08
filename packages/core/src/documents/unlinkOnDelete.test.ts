import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "../registry";
import { documentsTable, getDocument, putDocument, removeDocument } from "./store";
import type { DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({ id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra });
const types = [
  T("who", { unlinkOnDelete: true }),
  T("thing"),
  T("ev", { fields: [{ key: "with", label: "With", kind: "links" }] }),
  T("job", { fields: [{ key: "for", label: "For", kind: "link" }] }),
];
initApps([{ id: "t", title: "T", types, screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("a type that unlinks its Documents on delete", () => {
  it("takes a deleted Document's id out of every Link field that holds it, and leaves the rest", async () => {
    await putDocument({ id: "marc", type: "who", title: "Marc" });
    await putDocument({ id: "jo", type: "who", title: "Jo" });
    await putDocument({ id: "e1", type: "ev", title: "Dinner", with: ["marc", "jo"] });
    await putDocument({ id: "j1", type: "job", title: "Gift", for: "marc" });
    await putDocument({ id: "j2", type: "job", title: "Other", for: "jo" });
    await removeDocument("marc");
    expect((await getDocument("e1"))?.with).toEqual(["jo"]);
    expect((await getDocument("j1"))?.for).toBe("");
    expect((await getDocument("j2"))?.for).toBe("jo");
  });

  it("leaves a type that does not declare it as it was", async () => {
    await putDocument({ id: "x", type: "thing", title: "X" });
    await putDocument({ id: "e1", type: "ev", title: "Dinner", with: ["x"] });
    await removeDocument("x");
    expect((await getDocument("e1"))?.with).toEqual(["x"]);
  });
});
