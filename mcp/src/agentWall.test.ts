import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERSON_TYPE } from "@lifeline/core";
import type { Document, DocumentTypeDef, MacroRecord, OwnedCommand, TimedProvider } from "@lifeline/core";
import { pinsOf } from "@lifeline/core";
import { contactsApp } from "@lifeline/app-contacts";

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
const macros: MacroRecord[] = [];
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
    documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
    documentTypeSync: (id: string) => types.get(id),
    allDocumentTypes: () => [...types.values()],
    getDocument: async (id: string) => docs.get(id),
    allDocuments: async () => [...docs.values()],
    allMacros: async () => macros,
    allCommands: () => commands,
    timedProviders: () => timed,
    surfaceItemsIn: async () => ({ items: [], pool: [] }),
  };
});

const { runTool } = await import("./handlers");

// Through the manifest only, as the server takes it (apps.ts).
const personTypeDef = contactsApp.types.find((t) => t.id === PERSON_TYPE)!;
const contactsTimed = contactsApp.timed!;

// Every value is one no answer may hold: distinctive, so a hit is a leak, not a coincidence.
const addresses = [
  { id: "a1", label: "Zanzibar house", text: "12 Rue Quillardet, 75019 Paris", lat: 48.871234, lon: 2.381234, former: false },
  { id: "a2", label: "Old flat Brixtonia", text: "4 Coldharbour Lane, London", lat: 51.461987, lon: -0.113456, former: true },
];
// As the Person page's dialog stores them: current and former.
const contactDetails = [
  { id: "c1", label: "Mobile Qwz", kind: "phone", value: "+33 6 12 34 56 78", former: false },
  { id: "c2", label: "Mail Qwz", kind: "email", value: "anne.qwz@example.org", former: false },
  { id: "c3", label: "Insta Qwz", kind: "handle", value: "@anne_qwz_paints", former: true },
  { id: "c4", label: "Dead landline Qwz", kind: "phone", value: "+33 1 98 76 54 32", former: true },
];
const WALLED_VALUES = [
  ...addresses.flatMap((a) => [a.label, a.text, String(a.lat), String(a.lon)]),
  ...contactDetails.flatMap((c) => [c.label, c.value]),
  "addresses",
  "contactDetails",
];

const person = (id: string, title: string, folder = "People", extra: Record<string, unknown> = {}) =>
  ({
    id,
    type: PERSON_TYPE,
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
  { name: "search_documents", args: { type: PERSON_TYPE } },
  { name: "get_document", args: { id: "p1" } },
  { name: "get_document", args: { id: "t1" } },
  { name: "agenda", args: { start: "2026-11-01", end: "2026-11-30" } },
  { name: "list_types", args: {} },
  { name: "list_types", args: { type: PERSON_TYPE } },
  { name: "people_add", args: { name: "Anne Dupont", aliases: ["Mum"], relationship: "my mother", tags: ["family"] } },
  { name: "people_occasion_add", args: { person: "Anne Dupont", label: "Birthday", day: "1961-11-12" } },
  { name: "people_upcoming", args: { from: "2026-11-01", days: 60 } },
];

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  timed.length = 0;
  macros.length = 0;
  timed.push(contactsTimed);
  for (const fn of Object.values(core)) fn.mockReset().mockResolvedValue(undefined);
  core.createDocument.mockImplementation(async (input: { type: string; title: string }) => ({ ...person("new", input.title), ...input }));
  types.set(PERSON_TYPE, withGiftIdeas);
  types.set(tieType.id, tieType);
  docs.set("p1", person("p1", "Anne Dupont", "People", { giftIdeas: "a good sable brush", occasions: [{ id: "o1", label: "Birthday", day: "1961-11-12", yearly: true }] }));
  docs.set("t1", { id: "t1", type: tieType.id, title: "Anne – Léa", folder: "", tags: [], createdAt: "", updatedAt: "", deleted: 0 } as unknown as Document);
  commands.push(...contactsApp.commands.map((c) => ({ ...c, appId: "contacts" })));
});

describe("the agent wall: what an agent reads of a Person (ADR 0114)", () => {
  it.each(PERSON_TOOLS)("$name $args answers without any Address or Contact detail, current or former", async ({ name, args }) => {
    const answer = JSON.stringify(await runTool(name, args));
    for (const value of WALLED_VALUES) expect(answer, `${name} leaked “${value}”`).not.toContain(value);
  });

  it("holds as a rule about the Person type, not by the Fields it declares", async () => {
    types.set(PERSON_TYPE, { ...withGiftIdeas, fields: withGiftIdeas.fields.filter((f) => f.key !== "addresses" && f.key !== "contactDetails") });
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
    const got = (await runTool("get_document", { id: "p1" })) as { title: string; tags: string[]; body: string; fields: Record<string, unknown>; detail: Record<string, unknown> };
    expect(got).toMatchObject({ title: "Anne Dupont", tags: ["family"], body: "Loves watercolours. See [[Léa]]." });
    expect(got.fields).toEqual({ aliases: ["Mum"], relationship: "my mother", giftIdeas: "a good sable brush" });
    expect(got.detail.occasions).toEqual([{ label: "Birthday", day: "1961-11-12", yearly: true }]);
  });

  it("hands a type's `describe` the Person already behind the wall", async () => {
    const seen: Document[] = [];
    types.set(PERSON_TYPE, { ...withGiftIdeas, describe: async (d) => (seen.push(d), { echo: d }) });
    const answer = JSON.stringify(await runTool("get_document", { id: "p1" }));
    for (const value of WALLED_VALUES) expect(answer, `describe leaked “${value}”`).not.toContain(value);
    expect(seen[0]).not.toHaveProperty("addresses");
    expect(seen[0]).not.toHaveProperty("contactDetails");
  });

  it("still hides a Person in the Private folder as a whole", async () => {
    docs.set("p2", person("p2", "Secret friend", "Private/People"));
    expect(await runTool("search_documents", { query: "secret" })).toMatchObject({ total: 0 });
    await expect(runTool("get_document", { id: "p2" })).rejects.toThrow(/No Document p2/);
  });
});

describe("the agent wall: a Person's Pins (#418)", () => {
  it("stands on the map for its current Address, yet no tool answer holds that Pin", async () => {
    const pins = pinsOf([docs.get("p1")!], [withGiftIdeas], undefined, null as never);
    expect(pins.map((p) => p.name)).toEqual(["Anne Dupont · Zanzibar house"]);
    const pinWords = [...pins.flatMap((p) => [p.name, p.key]), "locatablePins"];
    for (const { name, args } of PERSON_TOOLS) {
      const answer = JSON.stringify(await runTool(name, args));
      for (const word of pinWords) expect(answer, `${name} leaked the Pin “${word}”`).not.toContain(word);
    }
    for (const t of ["search_documents", "list_types"]) expect(JSON.stringify(await runTool(t, {}))).not.toMatch(/"lat"|"lon"/);
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
    await expect(runTool("create_document", { type: PERSON_TYPE, title: "Léa", fields: { contactDetails: [] } })).rejects.toThrow();
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

  it("refuses to run a stored Macro whose step hands them to a Command, running nothing", async () => {
    macros.push({ id: "m1", name: "Sneak", sort: 0, updatedAt: "", deleted: 0, steps: [{ command: "contacts/people.add", args: { name: { from: "asked" }, contactDetails: { from: "fixed", value: [] } } }] });
    await expect(runTool("macro_sneak", { s1_name: "Léa" })).rejects.toThrow(/never written by an agent/);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("walls only the Person's keys on a Document: another type's own \"addresses\" Field is written", async () => {
    types.set("venue", { id: "venue", label: "Venues", titleRule: "name", body: "optional", builtIn: false, fields: [{ key: "addresses", label: "Addresses", kind: "text" }] });
    docs.set("v1", { id: "v1", type: "venue", title: "Hall", folder: "", tags: [], createdAt: "", updatedAt: "", deleted: 0 } as unknown as Document);
    await runTool("update_document", { id: "v1", fields: { addresses: "1 Main St" } });
    expect(core.patchDocument).toHaveBeenCalledWith("v1", { addresses: "1 Main St" });
  });

  it("writes a Field the user added to Person like any other", async () => {
    await runTool("update_document", { id: "p1", fields: { giftIdeas: "oil paints", relationship: "my mum" } });
    expect(core.patchDocument).toHaveBeenCalledWith("p1", { giftIdeas: "oil paints", relationship: "my mum" });
  });
});
