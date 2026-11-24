import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERSON_TYPE } from "@lifeline/core";
import type { Document, DocumentTypeDef, OwnedCommand, TimedProvider } from "@lifeline/core";
import { contactsApp, HOUSEHOLD, TIE } from "@lifeline/app-contacts";

// The People tools (ADR 0114): core's store is stood in for, as in handlers.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const timed: TimedProvider[] = [];
const core = vi.hoisted(() => ({ createDocument: vi.fn(), patchDocument: vi.fn() }));

vi.mock("@lifeline/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lifeline/core")>();
  return {
    ...actual,
    ...core,
    allWorkspaces: async () => [],
    workspaceScope: async () => "",
    setCurrentWorkspace: () => undefined,
    documentTypeSync: (id: string) => types.get(id),
    allDocumentTypes: () => [...types.values()],
    getDocument: async (id: string) => docs.get(id),
    allDocuments: async () => [...docs.values()],
    documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
    allMacros: async () => [],
    allCommands: () => commands,
    timedProviders: () => timed,
    surfaceItemsIn: async () => ({ items: [], pool: [] }),
    todayStr: () => "2026-11-08",
  };
});

// Core reads a link argument's candidates from its own store module, so it is stood in for there too.
vi.mock("../../packages/core/src/documents/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/store")>()),
  getDocument: async (id: string) => docs.get(id),
  allDocuments: async () => [...docs.values()],
  documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
}));

// …and its type, so a link argument reads the names the type derives (a Person's Given name).
vi.mock("../../packages/core/src/documents/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/registry")>()),
  documentTypeSync: (id: string) => types.get(id),
}));

const { runTool } = await import("./handlers");
// Through the manifest only, as the server takes it (apps.ts).
const personTypeDef = contactsApp.types.find((t) => t.id === PERSON_TYPE)!;
const tieTypeDef = contactsApp.types.find((t) => t.id === TIE)!;
const householdTypeDef = contactsApp.types.find((t) => t.id === HOUSEHOLD)!;
const contactsTimed = contactsApp.timed!;

const person = (id: string, title: string, extra: Record<string, unknown> = {}, folder = "People") =>
  ({ id, type: PERSON_TYPE, title, folder, tags: [], createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, aliases: [], relationship: "", ...extra }) as unknown as Document;

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  timed.length = 0;
  timed.push(contactsTimed);
  for (const fn of Object.values(core)) fn.mockReset().mockResolvedValue(undefined);
  core.createDocument.mockImplementation(async (input: { type: string; title: string; fields: Record<string, unknown> }) => ({ ...person("new", input.title), ...input.fields }));
  types.set(PERSON_TYPE, personTypeDef);
  types.set(TIE, tieTypeDef);
  types.set(HOUSEHOLD, householdTypeDef);
  commands.push(...contactsApp.commands.map((c) => ({ ...c, appId: "contacts" })));
  docs.set("p1", person("p1", "Anne Dupont", { aliases: ["Mum"], occasions: [{ id: "o1", label: "Birthday", day: "1961-11-12", yearly: true }, { id: "o2", label: "Surgery", day: "2026-11-09", yearly: false }] }));
  docs.set("p2", person("p2", "Anna", { aliases: ["Mum"], occasions: [{ id: "o3", label: "Birthday", day: "03-20", yearly: true }] }));
  docs.set("p3", person("p3", "Secret", { occasions: [{ id: "o4", label: "Birthday", day: "11-10", yearly: true }] }, "Private/People"));
});

describe("people_add", () => {
  it("adds a Person with aliases, a Relationship and Tags", async () => {
    await runTool("people_add", { name: "Léa", aliases: ["Lele"], relationship: "my friend", tags: ["friends"] });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ type: PERSON_TYPE, title: "Léa", fields: expect.objectContaining({ aliases: ["Lele"], relationship: "my friend", tags: ["friends"] }) }));
  });
  it("keeps a Given and a Family name beside the title", async () => {
    await runTool("people_add", { name: "Mum", givenName: "Anne", familyName: "Dupont" });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ title: "Mum", fields: expect.objectContaining({ givenName: "Anne", familyName: "Dupont" }) }));
  });
  it("refuses an empty name", async () => {
    await expect(runTool("people_add", { name: " " })).rejects.toThrow(/Name is required/);
  });
});

describe("people_occasion_add", () => {
  it("adds a yearly Occasion to the Person found by name", async () => {
    const out = await runTool("people_occasion_add", { person: "anne dupont", label: "Anniversary", day: "06-01" });
    expect(core.patchDocument).toHaveBeenCalledWith("p1", { occasions: expect.arrayContaining([expect.objectContaining({ label: "Anniversary", day: "06-01", yearly: true })]) });
    expect(out).toMatchObject({ id: "p1", message: "Added Anniversary (06-01, yearly) to Anne Dupont" });
  });
  it("adds a once Occasion with its year, by alias", async () => {
    docs.delete("p2");
    await runTool("people_occasion_add", { person: "Mum", label: "Wedding", day: "2027-05-01", yearly: false });
    expect(core.patchDocument).toHaveBeenCalledWith("p1", { occasions: expect.arrayContaining([expect.objectContaining({ label: "Wedding", day: "2027-05-01", yearly: false })]) });
  });
  it("finds the Person by their Given name, which is no alias (ADR 0117)", async () => {
    docs.set("p4", person("p4", "Granny", { givenName: "Odile" }));
    await runTool("people_occasion_add", { person: "odile", label: "Birthday", day: "04-02" });
    expect(core.patchDocument).toHaveBeenLastCalledWith("p4", expect.anything());
  });
  it("refuses an unknown Person, writing nothing", async () => {
    await expect(runTool("people_occasion_add", { person: "Bob", label: "Birthday", day: "01-01" })).rejects.toThrow("Person: No Person called “Bob”");
    expect(core.patchDocument).not.toHaveBeenCalled();
  });
  it("refuses an ambiguous name, listing each Person's title and id", async () => {
    await expect(runTool("people_occasion_add", { person: "Mum", label: "Birthday", day: "01-01" })).rejects.toThrow("Person: “Mum” is more than one Person: Anne Dupont (id p1), Anna (id p2)");
    expect(core.patchDocument).not.toHaveBeenCalled();
  });
  it("refuses a name that is one Person's title and another's alias", async () => {
    docs.set("p4", person("p4", "Mum"));
    await expect(runTool("people_occasion_add", { person: "mum", label: "Birthday", day: "01-01" })).rejects.toThrow(/more than one Person: Anne Dupont \(id p1\), Anna \(id p2\), Mum \(id p4\)/);
    expect(core.patchDocument).not.toHaveBeenCalled();
  });
  it("takes the Person by id, and by a name without its accents or with extra spaces", async () => {
    await runTool("people_occasion_add", { person: "p2", label: "Name day", day: "07-26" });
    expect(core.patchDocument).toHaveBeenLastCalledWith("p2", expect.anything());
    docs.set("p4", person("p4", "Léa  Martin"));
    await runTool("people_occasion_add", { person: " LEA martin ", label: "Birthday", day: "02-14" });
    expect(core.patchDocument).toHaveBeenLastCalledWith("p4", expect.anything());
  });
  it("is described as taking an id, the title or an alias, under the key person", async () => {
    const { TOOLS } = await import("./tools");
    const tool = TOOLS.find((t) => t.name === "people_occasion_add")!;
    expect(tool.input.person!.description).toMatch(/an id, the title or an alias/);
  });
  it("refuses a day that is none, or a once Occasion with no year", async () => {
    await expect(runTool("people_occasion_add", { person: "Anna", label: "Birthday", day: "13-40" })).rejects.toThrow(/real day/);
    await expect(runTool("people_occasion_add", { person: "Anna", label: "Wedding", day: "05-01", yearly: false })).rejects.toThrow(/needs its year/);
  });
});

describe("people_exchange_add (ADR 0131)", () => {
  beforeEach(() => {
    core.createDocument.mockImplementation(async (input: { type: string; title: string; body?: string; fields: Record<string, unknown> }) => ({ ...person("x1", input.title), type: input.type, body: input.body, ...input.fields }));
  });

  it("records a kind, a day, its People by name and what was said", async () => {
    const out = await runTool("people_exchange_add", { with: ["anne dupont", "Anna"], kind: "video", date: "2026-11-01", body: "The hip surgery went well." });
    expect(core.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ type: "contacts_exchange", title: "Video call · Anne Dupont, Anna", body: "The hip surgery went well.", fields: { kind: "video", date: "2026-11-01", with: ["p1", "p2"] } }),
    );
    expect(out).toMatchObject({ id: "x1", message: "Logged Video call · Anne Dupont, Anna on 2026-11-01" });
  });

  it("is a call today unless told otherwise", async () => {
    await runTool("people_exchange_add", { with: ["Anna"] });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ title: "Call · Anna", fields: { kind: "call", date: "2026-11-08", with: ["p2"] } }));
  });

  it("refuses a day to come, writing nothing", async () => {
    await expect(runTool("people_exchange_add", { with: ["Anna"], date: "2026-11-09" })).rejects.toThrow("An exchange is something that happened. Plan a call as a Task or an Event.");
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses an exchange with nobody", async () => {
    await expect(runTool("people_exchange_add", { with: [] })).rejects.toThrow(/With/);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses an unknown or ambiguous name, listing the candidates", async () => {
    await expect(runTool("people_exchange_add", { with: ["Bob"] })).rejects.toThrow("No Person called “Bob”");
    await expect(runTool("people_exchange_add", { with: ["Mum"] })).rejects.toThrow("“Mum” is more than one Person: Anne Dupont (id p1), Anna (id p2)");
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses a kind that is none of the four", async () => {
    await expect(runTool("people_exchange_add", { with: ["Anna"], kind: "telegram" })).rejects.toThrow("Kind: expected one of call, video, message, letter");
    expect(core.createDocument).not.toHaveBeenCalled();
  });
});

describe("Exchanges are open to agents (ADR 0131)", () => {
  const exchangeTypeDef = contactsApp.types.find((t) => t.id === "contacts_exchange")!;
  beforeEach(() => {
    types.set("contacts_exchange", exchangeTypeDef);
    docs.set("x1", { id: "x1", type: "contacts_exchange", title: "Call · Anne Dupont", kind: "call", date: "2026-11-01", with: ["p1"], body: "Lucie starts university in Lyon.", folder: "People/Exchanges", tags: [], createdAt: "2026-11-01", updatedAt: "2026-11-01", deleted: 0 } as unknown as Document);
  });

  it("are found by what was said, with their kind and day", async () => {
    const out = (await runTool("search_documents", { query: "Lyon" })) as { documents: Record<string, unknown>[] };
    expect(out.documents).toEqual([expect.objectContaining({ id: "x1", title: "Call · Anne Dupont" })]);
    expect(JSON.stringify(out.documents[0])).toContain("2026-11-01");
  });

  it("are read whole by get_document, body included", async () => {
    const out = (await runTool("get_document", { id: "x1" })) as { body: string; fields: Record<string, unknown> };
    expect(out).toMatchObject({ body: "Lucie starts university in Lyon.", fields: { kind: "call", date: "2026-11-01", with: ["p1"] } });
  });
  it("never name a Person in the Private folder, in the title they are found or read by (ADR 0038)", async () => {
    // An agent cannot name them at all, by name or id: refused as unknown, nothing logged (ADR 0114).
    for (const who of ["Secret", "p3"]) {
      const refused = await runTool("people_exchange_add", { with: ["Anne Dupont", who], date: "2026-11-02", body: "Dinner on Friday." }).then(
        () => "logged",
        (e: Error) => e.message,
      );
      expect(refused).toBe(`With: No Person called “${who}”`);
    }
    expect(core.createDocument).not.toHaveBeenCalled();
    // Logged by the user where Private was open: the title the App stores (exchanges.test.ts), kept as it is.
    docs.set("x2", { ...person("x2", "Call · Anne Dupont, someone", {}, "People/Exchanges"), type: "contacts_exchange", kind: "call", date: "2026-11-02", body: "Dinner on Friday.", with: ["p1", "p3"] } as unknown as Document);
    const found = (await runTool("search_documents", { query: "Secret" })) as { documents: Record<string, unknown>[] };
    expect(found.documents.map((d) => d.id)).not.toContain("x2");
    expect(JSON.stringify(found)).not.toContain("Secret");
    const byBody = (await runTool("search_documents", { query: "Friday" })) as { documents: Record<string, unknown>[] };
    expect(byBody.documents).toEqual([expect.objectContaining({ id: "x2", title: "Call · Anne Dupont, someone" })]);
    expect(JSON.stringify(await runTool("get_document", { id: "x2" }))).not.toContain("Secret");
  });
});

describe("people_upcoming", () => {
  it("lists Occasions in the window, soonest first, with ages", async () => {
    const out = (await runTool("people_upcoming", { days: 7 })) as { from: string; occasions: { personId: string; name: string; title: string; date: string; inDays: number; age: number | null }[] };
    expect(out.from).toBe("2026-11-08");
    expect(out.occasions.map((o) => [o.personId, o.name, o.title, o.date, o.inDays, o.age])).toEqual([
      ["p1", "Anne Dupont", "⚑ Anne Dupont · Surgery", "2026-11-09", 1, null],
      ["p1", "Anne Dupont", "🎂 Anne Dupont · 65", "2026-11-12", 4, 65],
    ]);
  });
  it("starts from a given day and leaves out the Private folder", async () => {
    const out = (await runTool("people_upcoming", { from: "2026-11-10", days: 0 })) as { occasions: unknown[] };
    expect(out.occasions).toEqual([]);
  });
});

describe("agenda", () => {
  it("lists Occasions with the age a Birthday reaches", async () => {
    const out = (await runTool("agenda", { start: "2026-11-08", end: "2026-11-14" })) as { days: Record<string, { kind: string; title: string; age?: number }[]> };
    expect(out.days["2026-11-12"]).toEqual([expect.objectContaining({ kind: "occasion", title: "🎂 Anne Dupont · 65", age: 65 })]);
    expect(out.days["2026-11-09"]).toEqual([expect.objectContaining({ kind: "occasion", age: undefined })]);
    // Secret's Birthday (the 10th) is in the Private folder: never shown.
    expect(out.days["2026-11-10"]).toBeUndefined();
  });
});

describe("get_document of a Person: Reports", () => {
  it("gives Last seen, Last talked and Last mentioned, counting no Private Day", async () => {
    const day = (id: string, title: string, body: string, folder = "") => ({ id, type: "daily", title, folder, tags: [], body, createdAt: "", updatedAt: "", deleted: 0 }) as unknown as Document;
    types.set("daily", { id: "daily", label: "Days", builtIn: true, titleRule: "name", body: "required", fields: [], linkable: false } as unknown as DocumentTypeDef);
    docs.set("d1", day("d1", "2026-11-01", "Lunch with [[Anne Dupont]]"));
    docs.set("d2", day("d2", "2026-11-05", "Wrote to [[Anne Dupont]]", "Private"));
    const out = (await runTool("get_document", { id: "p1" })) as { detail: { reports: { lastMentioned: { last?: string; allTime: number }; lastSeen: { last?: string }; lastTalked: { allTime: number } } } };
    expect(out.detail.reports.lastMentioned).toMatchObject({ last: "2026-11-01", allTime: 1 });
    expect(out.detail.reports.lastSeen.last).toBeUndefined();
    expect(out.detail.reports.lastTalked).toMatchObject({ allTime: 0 });
  });
});

describe("get_document of a Person: Ties", () => {
  const tie = (id: string, a: string, b: string, labelA: string, labelB: string) =>
    ({ id, type: TIE, title: "", folder: "", tags: [], createdAt: "", updatedAt: "", deleted: 0, a, b, labelA, labelB }) as unknown as Document;
  it("reads each Tie from the Person's side, with the other Person's id and title", async () => {
    docs.set("p4", person("p4", "Léa"));
    docs.set("t1", tie("t1", "p1", "p4", "mother", "daughter"));
    const fromAnne = (await runTool("get_document", { id: "p1" })) as { detail: { ties: unknown[] } };
    expect(fromAnne.detail.ties).toEqual([{ label: "daughter", id: "p4", title: "Léa" }]);
    const fromLea = (await runTool("get_document", { id: "p4" })) as { detail: { ties: unknown[] } };
    expect(fromLea.detail.ties).toEqual([{ label: "mother", id: "p1", title: "Anne Dupont" }]);
  });
  it("leaves out a Tie to a Person in the Private folder", async () => {
    docs.set("t2", tie("t2", "p3", "p1", "friend", "friend"));
    const out = (await runTool("get_document", { id: "p1" })) as { detail: { ties: unknown[] } };
    expect(out.detail.ties).toEqual([]);
    expect(JSON.stringify(out)).not.toContain("Secret");
  });
});

describe("get_document of a Household (ADR 0117)", () => {
  const walled = { addresses: [{ id: "a1", label: "Home", text: "1 Rue Secrète", former: false }], contactDetails: [{ id: "c1", label: "Mobile", kind: "phone", value: "+33 6 12 34 56 78", former: false }] };
  it("gives its name, aliases and members by name, and nothing walled of any member", async () => {
    docs.set("p1", { ...docs.get("p1")!, ...walled } as Document);
    docs.set("h1", { id: "h1", type: HOUSEHOLD, title: "the Duponts", aliases: ["Duponts"], members: [{ personId: "p1" }, { personId: "p3" }], folder: "People/Households", tags: [], createdAt: "", updatedAt: "", deleted: 0 } as unknown as Document);
    const out = (await runTool("get_document", { id: "h1" })) as { title: string; fields: Record<string, unknown>; detail: { members: unknown[] } };
    expect(out.title).toBe("the Duponts");
    expect(out.fields).toEqual({ aliases: ["Duponts"] });
    // The member in the Private folder is left out, as a Tie to them is.
    expect(out.detail.members).toEqual([{ id: "p1", title: "Anne Dupont" }]);
    expect(JSON.stringify(out)).not.toMatch(/Secrète|12 34|Secret/);
  });
});
