import { beforeEach, describe, expect, it } from "vitest";
import { canWear, fieldsOfDocument, hasRole, isLinkTarget, registerBuiltinRoles, rolesOf, wearableRoles, withRoleFields, type RoleDef } from "./roles";
import { buildLinkIndex } from "./links";
import { documentToText, textToDocument } from "./text";
import { pickLinked } from "../commands";
import { typeFieldsOf, type Document, type DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id + "s", titleRule: "name", body: "optional", fields: [], linkable: true, builtIn: true, ...extra,
});
const doc = (id: string, type: string, title: string, extra: Record<string, unknown> = {}): Document => ({
  id, type, title, body: "", folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "", deleted: 0, ...extra,
});

const AUTHOR: RoleDef = {
  id: "author",
  label: "Author",
  homeType: "author",
  fields: [
    { key: "born", label: "Born", kind: "text" },
    { key: "aliases", label: "Aliases", kind: "list" },
  ],
};
const ownWords = new Set(["note"]);
const SOURCE: RoleDef = { id: "source", label: "Source", homeType: "source", fields: [{ key: "url", label: "URL", kind: "url" }], wearable: (d) => !!d.linkable && !ownWords.has(d.id) };

const types = [
  T("author", { fields: [{ key: "aliases", label: "Aliases", kind: "list" }, { key: "born", label: "Born", kind: "text" }] }),
  T("person", { fields: [{ key: "aliases", label: "Aliases", kind: "list" }, { key: "met", label: "Met", kind: "date" }] }),
  T("book", { fields: [{ key: "authors", label: "Authors", kind: "links", linkRole: "author" }] }),
  T("note"),
  T("source"),
  T("task", { linkable: false }),
  T("version", { internal: true, linkable: false }),
];
const def = (id: string) => types.find((t) => t.id === id)!;

beforeEach(() => registerBuiltinRoles([AUTHOR, SOURCE]));

describe("rolesOf", () => {
  it("a home type's Documents play its Role without wearing it", () => {
    expect(rolesOf(doc("a", "author", "Le Guin")).map((r) => r.id)).toEqual(["author"]);
  });

  it("a wearer plays its type's Roles and the ones it wears, unknown ids ignored", () => {
    const ursula = doc("p", "person", "Ursula", { roles: ["author", "gone"] });
    expect(rolesOf(ursula).map((r) => r.id)).toEqual(["author"]);
    expect(hasRole(ursula, "author")).toBe(true);
    expect(hasRole(ursula, "source")).toBe(false);
  });
});

describe("playedBy", () => {
  it("a type the Role names plays it by construction, and cannot put it on", () => {
    registerBuiltinRoles([AUTHOR, { ...SOURCE, playedBy: ["book"] }]);
    const book = doc("b", "book", "Earthsea");
    expect(hasRole(book, "source")).toBe(true);
    expect(canWear(def("book"), { ...SOURCE, playedBy: ["book"] })).toBe(false);
    expect(fieldsOfDocument({ ...book, roles: ["source"] }, def("book"))).toBe(def("book").fields);
    expect(isLinkTarget({ linkRole: "source" }, book)).toBe(true);
  });
});

describe("canWear", () => {
  it("any Linkable, non-internal type by default — never the home type, which plays it already", () => {
    expect(canWear(def("person"), AUTHOR)).toBe(true);
    expect(canWear(def("author"), AUTHOR)).toBe(false);
    expect(canWear(def("task"), AUTHOR)).toBe(false);
    expect(canWear(def("version"), AUTHOR)).toBe(false);
  });

  it("a Role may narrow who wears it — my own words are never a Source", () => {
    expect(canWear(def("note"), SOURCE)).toBe(false);
    expect(canWear(def("person"), SOURCE)).toBe(true);
  });

  it("wearableRoles leaves out what the Document already plays", () => {
    const ursula = doc("p", "person", "Ursula", { roles: ["author"] });
    expect(wearableRoles(ursula, def("person")).map((r) => r.id)).toEqual(["source"]);
  });
});

describe("fieldsOfDocument", () => {
  it("adds a worn Role's Fields after the type's, the type keeping a key both declare", () => {
    const ursula = doc("p", "person", "Ursula", { roles: ["author"] });
    expect(fieldsOfDocument(ursula, def("person")).map((f) => f.key)).toEqual(["aliases", "met", "born"]);
  });

  it("is the type's own Fields for a home-type Document or one wearing nothing", () => {
    expect(fieldsOfDocument(doc("a", "author", "Le Guin"), def("author"))).toBe(def("author").fields);
    expect(withRoleFields(doc("p", "person", "Ursula"), def("person"))).toBe(def("person"));
  });
});

describe("isLinkTarget", () => {
  it("linkRole matches the home type and every wearer, and nothing else", () => {
    const authors = { linkRole: "author" };
    expect(isLinkTarget(authors, doc("a", "author", "Le Guin"))).toBe(true);
    expect(isLinkTarget(authors, doc("p", "person", "Ursula", { roles: ["author"] }))).toBe(true);
    expect(isLinkTarget(authors, doc("q", "person", "Bob"))).toBe(false);
  });

  it("linkType and the default are unchanged", () => {
    expect(isLinkTarget({ linkType: "person" }, doc("q", "person", "Bob"))).toBe(true);
    expect(isLinkTarget({}, doc("q", "person", "Bob"), def("person"))).toBe(true);
    expect(isLinkTarget({}, doc("t", "task", "Do"), def("task"))).toBe(false);
  });
});

describe("Roles through the generic tooling", () => {
  it("a Role's Link field raises a Backlink like the type's own", () => {
    const SHELF: RoleDef = { id: "shelf", label: "Shelf", homeType: "author", fields: [{ key: "favourite", label: "Favourite", kind: "link" }] };
    registerBuiltinRoles([AUTHOR, SOURCE, SHELF]);
    const docs = [doc("p", "person", "Ursula", { roles: ["shelf"], favourite: "b" }), doc("b", "book", "Earthsea")];
    const idx = buildLinkIndex(docs, types);
    expect(idx.backlinksTo("b").map((b) => [b.sourceId, b.field])).toEqual([["p", "favourite"]]);
  });

  it("text mode shows the worn Role's Fields and never the roles list itself", () => {
    const ursula = doc("p", "person", "Ursula", { roles: ["author"], born: "1929" });
    const text = documentToText(ursula, withRoleFields(ursula, def("person")));
    expect(text).toContain("born: ");
    expect(text).not.toContain("roles");
    const { patch } = textToDocument(text.replace("1929", "1930"), ursula, withRoleFields(ursula, def("person")));
    expect(patch.born).toBe("1930");
    expect("roles" in patch).toBe(false);
    expect("roles" in typeFieldsOf(ursula)).toBe(false);
  });

  it("a Command's link argument by Role resolves a wearer by title", () => {
    const docs = [doc("a", "author", "Le Guin"), doc("p", "person", "Ursula", { roles: ["author"] }), doc("q", "person", "Bob")];
    const arg = { key: "author", label: "Author", kind: "link" as const, linkRole: "author" };
    expect(pickLinked(arg, "ursula", docs)).toBe("p");
    expect(() => pickLinked(arg, "Bob", docs)).toThrow(/no author/);
  });
});
