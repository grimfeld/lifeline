import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentTypeDef, OwnedCommand, TimedProvider } from "@lifeline/core";
import { personTypeDef } from "@lifeline/app-contacts/src/types";
import { contactsCommands } from "@lifeline/app-contacts/src/commands";
import type { Address, ContactDetail } from "@lifeline/app-contacts/src/domain/types";
import { markFormer, saveDetail, type DetailInput } from "@lifeline/app-contacts/src/domain/contactDetails";

/**
 * The agent wall (ADR 0114): no tool answer ever carries a Person's Addresses
 * or Contact details, current or former, and no tool writes them.
 *
 * A ticket that adds a tool which can return a Person (or anything made from
 * one: an Occasion marker, a Tie, a Report) adds a call to `PERSON_TOOLS`
 * below; a ticket that adds a Timed provider for People pushes it onto
 * `timed`. The sweep then checks it with every other tool.
 */

// Core's store is stood in for, as in handlers.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const timed: TimedProvider[] = [];
const core = vi.hoisted(() => ({
  createDocument: vi.fn(),
  moveDocument: vi.fn(),
  renameDocument: vi.fn(),
  patchDocument: vi.fn(),
  saveMacro: vi.fn(),
}));

vi.mock("@lifeline/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lifeline/core")>();
  return {
    ...actual,
    ...core,
    allWorkspaces: async () => [],
    setCurrentWorkspace: () => undefined,
    documentTypeSync: (id: string) => types.get(id),
    allDocumentTypes: () => [...types.values()],
    getDocument: async (id: string) => docs.get(id),
    allDocuments: async () => [...docs.values()],
    allMacros: async () => [],
    allCommands: () => commands,
    timedProviders: () => timed,
    surfaceItemsIn: async () => ({ items: [], pool: [] }),
  };
});

const { runTool } = await import("./handlers");

const PERSON = personTypeDef.id;

// Every value is one no answer may hold: distinctive, so a hit is a leak, not a coincidence.
const addresses: Address[] = [
  { id: "a1", label: "Zanzibar house", text: "12 Rue Quillardet, 75019 Paris", lat: 48.871234, lon: 2.381234, former: false },
  { id: "a2", label: "Old flat Brixtonia", text: "4 Coldharbour Lane, London", lat: 51.461987, lon: -0.113456, former: true },
];
// Made as the Person page's dialog makes them (saveDetail, markFormer), so the wall is checked against what is really stored.
const contactDetails: ContactDetail[] = (() => {
  let ids = 0;
  const add = (list: ContactDetail[], input: DetailInput) => saveDetail(list, input, () => `c${++ids}`);
  let list: ContactDetail[] = [];
  list = add(list, { label: " Mobile Qwz ", kind: "phone", value: "+33 6 12 34 56 78" });
  list = add(list, { label: "Mail Qwz", kind: "email", value: "anne.qwz@example.org" });
  list = add(list, { label: "Insta Qwz", kind: "handle", value: "@anne_qwz_paints" });
  list = add(list, { label: "Dead landline Qwz", kind: "phone", value: "+33 1 98 76 54 32" });
  return markFormer(markFormer(list, "c3", true), "c4", true);
})();
const WALLED_VALUES = [
  ...addresses.flatMap((a) => [a.label, a.text, String(a.lat), String(a.lon)]),
  ...contactDetails.flatMap((c) => [c.label, c.value]),
  "addresses",
  "contactDetails",
];

const person = (id: string, title: string, folder = "People", extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: PERSON,
    title,
    folder,
    tags: ["family"],
    createdAt: "2026-01-01",
    updatedAt: "2026-11-01",
    deleted: 0,
    aliases: ["Mum"],
    relationship: "my mother",
    body: "Loves watercolours. See [[Léa]].",
    addresses,
    contactDetails,
    ...extra,
  }) as unknown as Document;

/** A Field the user added to Person themselves: it crosses like any Field (ADR 0114). */
const withGiftIdeas: DocumentTypeDef = { ...personTypeDef, fields: [...personTypeDef.fields, { key: "giftIdeas", label: "Gift ideas", kind: "text" }] };

/** A Tie: internal, answering as the Person that owns it (ADR 0098). */
const tieType: DocumentTypeDef = { id: "contacts_tie", label: "Ties", titleRule: "derived", body: "none", internal: true, builtIn: true, fields: [], owner: async () => docs.get("p1") };

/**
 * Every tool that can answer with a Person, or with anything read from one.
 * Add yours here.
 */
const PERSON_TOOLS: { name: string; args: Record<string, unknown> }[] = [
  { name: "search_documents", args: {} },
  { name: "search_documents", args: { query: "anne" } },
  { name: "search_documents", args: { type: PERSON } },
  { name: "get_document", args: { id: "p1" } },
  { name: "get_document", args: { id: "t1" } },
  { name: "agenda", args: { start: "2026-11-01", end: "2026-11-30" } },
  { name: "list_types", args: {} },
  { name: "list_types", args: { type: PERSON } },
  { name: "people_add", args: { name: "Anne Dupont", aliases: ["Mum"], relationship: "my mother" } },
];

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  for (const fn of Object.values(core)) fn.mockReset().mockResolvedValue(undefined);
  core.createDocument.mockImplementation(async (input: { type: string; title: string }) => ({ ...person("new", input.title), ...input }));
  types.set(PERSON, withGiftIdeas);
  types.set(tieType.id, tieType);
  docs.set("p1", person("p1", "Anne Dupont", "People", { giftIdeas: "a good sable brush" }));
  docs.set("t1", { id: "t1", type: tieType.id, title: "Anne – Léa", folder: "", tags: [], createdAt: "", updatedAt: "", deleted: 0 } as unknown as Document);
  commands.push(...contactsCommands.map((c) => ({ ...c, appId: "contacts" })));
});

describe("the agent wall: what an agent reads of a Person (ADR 0114)", () => {
  it.each(PERSON_TOOLS)("$name $args answers without any Address or Contact detail, current or former", async ({ name, args }) => {
    const answer = JSON.stringify(await runTool(name, args));
    for (const value of WALLED_VALUES) expect(answer, `${name} leaked “${value}”`).not.toContain(value);
  });

  it("holds as a rule about the Person type, not by the Fields it declares", async () => {
    types.set(PERSON, { ...withGiftIdeas, fields: withGiftIdeas.fields.filter((f) => f.key !== "addresses" && f.key !== "contactDetails") });
    for (const { name, args } of PERSON_TOOLS) {
      const answer = JSON.stringify(await runTool(name, args));
      for (const value of WALLED_VALUES) expect(answer, `${name} leaked “${value}”`).not.toContain(value);
    }
    await expect(runTool("update_document", { id: "p1", fields: { addresses: [] } })).rejects.toThrow(/never written by an agent/);
  });

  it("finds no Person by the words of their Addresses or Contact details", async () => {
    for (const query of ["Quillardet", "Coldharbour", "Zanzibar", "anne.qwz", "anne_qwz_paints", "+33 6 12"]) {
      expect(await runTool("search_documents", { query }), query).toMatchObject({ total: 0 });
    }
  });

  it("answers with the rest of the Person: name, aliases, Relationship, Tags, body and the user's own Fields", async () => {
    const got = (await runTool("get_document", { id: "p1" })) as { title: string; tags: string[]; body: string; fields: Record<string, unknown> };
    expect(got).toMatchObject({ title: "Anne Dupont", tags: ["family"], body: "Loves watercolours. See [[Léa]]." });
    expect(got.fields).toEqual({ aliases: ["Mum"], relationship: "my mother", giftIdeas: "a good sable brush" });
  });

  it("still hides a Person in the Private folder as a whole", async () => {
    docs.set("p2", person("p2", "Secret friend", "Private/People"));
    expect(await runTool("search_documents", { query: "secret" })).toMatchObject({ total: 0 });
    await expect(runTool("get_document", { id: "p2" })).rejects.toThrow(/No Document p2/);
  });
});

describe("the agent wall: what an agent writes of a Person (ADR 0114)", () => {
  it.each([
    ["an Address", { addresses: [{ id: "x", label: "Home", text: "1 Fake St", former: false }] }],
    ["a Contact detail", { contactDetails: [{ id: "x", label: "Mobile", kind: "phone", value: "+1 555", former: false }] }],
    ["former Addresses, by clearing them", { addresses: null }],
    ["former Contact details, by clearing them", { contactDetails: null }],
  ])("refuses to write %s through update_document, writing nothing", async (_, fields) => {
    await expect(runTool("update_document", { id: "p1", title: "Anne D.", fields })).rejects.toThrow(/never written by an agent/);
    expect(core.patchDocument).not.toHaveBeenCalled();
    expect(core.renameDocument).not.toHaveBeenCalled();
  });

  it("refuses them through create_document", async () => {
    await expect(runTool("create_document", { type: PERSON, title: "Léa", fields: { contactDetails: [] } })).rejects.toThrow();
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses them through the Contacts App's own tools", async () => {
    await expect(runTool("people_add", { name: "Léa", addresses: [{ text: "1 Fake St" }] })).rejects.toThrow(/never written by an agent/);
    await expect(runTool("people_add", { name: "Léa", contactDetails: [] })).rejects.toThrow(/never written by an agent/);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses a Macro step that would hand them to a Contacts Command", async () => {
    await expect(runTool("create_macro", { name: "Sneak", steps: [{ command: "contacts/people.add", args: { name: { from: "asked" }, addresses: { from: "fixed", value: [] } } }] })).rejects.toThrow(/never written by an agent/);
    expect(core.saveMacro).not.toHaveBeenCalled();
  });

  it("writes a Field the user added to Person like any other", async () => {
    await runTool("update_document", { id: "p1", fields: { giftIdeas: "oil paints", relationship: "my mum" } });
    expect(core.patchDocument).toHaveBeenCalledWith("p1", { giftIdeas: "oil paints", relationship: "my mum" });
  });
});
