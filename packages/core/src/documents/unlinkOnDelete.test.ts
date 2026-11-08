import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { initApps } from "../registry";
import { documentsTable, getDocument, linkHolders, putDocument, removeDocument } from "./store";
import type { RoleDef } from "./roles";
import type { DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({ id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra });
const types = [
  T("who", { unlinkOnDelete: true }),
  T("thing"),
  T("ev", { fields: [{ key: "with", label: "With", kind: "links" }] }),
  T("job", { fields: [{ key: "for", label: "For", kind: "link" }] }),
  T("book", { fields: [{ key: "authors", label: "Authors", kind: "links", linkType: "thing" }, { key: "by", label: "Recommended by", kind: "links", linkType: ["who", "thing"] }] }),
  T("note", { fields: [{ key: "about", label: "About", kind: "text" }] }),
];
// A Role any Document may wear, with a Link field of its own.
const sponsor: RoleDef = { id: "sponsor", label: "Sponsor", homeType: "job", fields: [{ key: "backer", label: "Backer", kind: "link", linkType: "who" }] } as RoleDef;
initApps([{ id: "t", title: "T", types, roles: [sponsor], screens: [], cards: [], commands: [] }]);

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

  it("takes it out of a Field worn through a Role, on a type with no such Field of its own", async () => {
    await putDocument({ id: "marc", type: "who", title: "Marc" });
    await putDocument({ id: "n1", type: "note", title: "Gala", roles: ["sponsor"], backer: "marc" });
    await removeDocument("marc");
    expect((await getDocument("n1"))?.backer).toBe("");
  });
});

describe("where a link to a type can be stored", () => {
  it("counts a Field restricted to a Role's players, whatever type it names", () => {
    const gig = T("gig", { fields: [{ key: "host", label: "Host", kind: "link", linkType: "thing", linkRole: "sponsor" }] });
    expect(linkHolders("who", [gig], []).types).toEqual(["gig"]);
  });
  it("is the types and Roles with a Link field that may hold it, never one restricted to another type", () => {
    expect(linkHolders("who", types, [sponsor])).toEqual({ types: ["ev", "job", "book"], roles: ["sponsor"] });
    expect(linkHolders("thing", types, [sponsor])).toEqual({ types: ["ev", "job", "book"], roles: [] });
  });
});
