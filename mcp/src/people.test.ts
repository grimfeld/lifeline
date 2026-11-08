import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentTypeDef, OwnedCommand, TimedProvider } from "@lifeline/core";
import { personTypeDef } from "@lifeline/app-contacts/src/types";
import { contactsCommands } from "@lifeline/app-contacts/src/commands";
import { contactsTimed } from "@lifeline/app-contacts/src/timed";

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

const { runTool } = await import("./handlers");
const PERSON = personTypeDef.id;

const person = (id: string, title: string, extra: Record<string, unknown> = {}, folder = "People") =>
  ({ id, type: PERSON, title, folder, tags: [], createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, aliases: [], relationship: "", ...extra }) as unknown as Document;

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  timed.length = 0;
  timed.push(contactsTimed);
  for (const fn of Object.values(core)) fn.mockReset().mockResolvedValue(undefined);
  core.createDocument.mockImplementation(async (input: { type: string; title: string; fields: Record<string, unknown> }) => ({ ...person("new", input.title), ...input.fields }));
  types.set(PERSON, personTypeDef);
  commands.push(...contactsCommands.map((c) => ({ ...c, appId: "contacts" })));
  docs.set("p1", person("p1", "Anne Dupont", { aliases: ["Mum"], occasions: [{ id: "o1", label: "Birthday", day: "1961-11-12", yearly: true }, { id: "o2", label: "Surgery", day: "2026-11-09", yearly: false }] }));
  docs.set("p2", person("p2", "Anna", { aliases: ["Mum"], occasions: [{ id: "o3", label: "Birthday", day: "03-20", yearly: true }] }));
  docs.set("p3", person("p3", "Secret", { occasions: [{ id: "o4", label: "Birthday", day: "11-10", yearly: true }] }, "Private/People"));
});

describe("people_add", () => {
  it("adds a Person with aliases, a Relationship and Tags", async () => {
    await runTool("people_add", { name: "Léa", aliases: ["Lele"], relationship: "my friend", tags: ["friends"] });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ type: PERSON, title: "Léa", fields: expect.objectContaining({ aliases: ["Lele"], relationship: "my friend", tags: ["friends"] }) }));
  });
  it("refuses an empty name", async () => {
    await expect(runTool("people_add", { name: " " })).rejects.toThrow(/Name is required/);
  });
});

describe("people_occasion_add", () => {
  it("adds a yearly Occasion to the Person found by name", async () => {
    const out = await runTool("people_occasion_add", { person: "anne dupont", label: "Anniversary", day: "06-01" });
    expect(core.patchDocument).toHaveBeenCalledWith("p1", { occasions: expect.arrayContaining([expect.objectContaining({ label: "Anniversary", day: "06-01", yearly: true })]) });
    expect(out).toMatchObject({ id: "p1", message: expect.stringContaining("Anne Dupont") });
  });
  it("adds a once Occasion with its year, by alias", async () => {
    docs.delete("p2");
    await runTool("people_occasion_add", { person: "Mum", label: "Wedding", day: "2027-05-01", yearly: false });
    expect(core.patchDocument).toHaveBeenCalledWith("p1", { occasions: expect.arrayContaining([expect.objectContaining({ label: "Wedding", day: "2027-05-01", yearly: false })]) });
  });
  it("refuses an unknown Person, writing nothing", async () => {
    await expect(runTool("people_occasion_add", { person: "Bob", label: "Birthday", day: "01-01" })).rejects.toThrow(/No Person called “Bob”/);
    expect(core.patchDocument).not.toHaveBeenCalled();
  });
  it("refuses an ambiguous name, naming who it could be", async () => {
    await expect(runTool("people_occasion_add", { person: "Mum", label: "Birthday", day: "01-01" })).rejects.toThrow(/ambiguous: Anne Dupont, Anna/);
    expect(core.patchDocument).not.toHaveBeenCalled();
  });
  it("refuses a day that is none, or a once Occasion with no year", async () => {
    await expect(runTool("people_occasion_add", { person: "Anna", label: "Birthday", day: "13-40" })).rejects.toThrow(/real day/);
    await expect(runTool("people_occasion_add", { person: "Anna", label: "Wedding", day: "05-01", yearly: false })).rejects.toThrow(/needs its year/);
  });
});

describe("people_upcoming", () => {
  it("lists Occasions in the window, soonest first, with ages", async () => {
    const out = (await runTool("people_upcoming", { days: 7 })) as { from: string; occasions: { name: string; label: string; date: string; inDays: number; age: number | null }[] };
    expect(out.from).toBe("2026-11-08");
    expect(out.occasions.map((o) => [o.name, o.label, o.date, o.inDays, o.age])).toEqual([
      ["Anne Dupont", "Surgery", "2026-11-09", 1, null],
      ["Anne Dupont", "Birthday", "2026-11-12", 4, 65],
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
  });
});

describe("get_document of a Person: Reports", () => {
  it("gives Last seen and Last mentioned, counting no Private Day", async () => {
    const day = (id: string, title: string, body: string, folder = "") => ({ id, type: "daily", title, folder, tags: [], body, createdAt: "", updatedAt: "", deleted: 0 }) as unknown as Document;
    types.set("daily", { id: "daily", label: "Days", builtIn: true, titleRule: "name", body: "required", fields: [], linkable: false } as unknown as DocumentTypeDef);
    docs.set("d1", day("d1", "2026-11-01", "Lunch with [[Anne Dupont]]"));
    docs.set("d2", day("d2", "2026-11-05", "Wrote to [[Anne Dupont]]", "Private"));
    const out = (await runTool("get_document", { id: "p1" })) as { reports: { lastMentioned: { last?: string; allTime: number }; lastSeen: { last?: string } } };
    expect(out.reports.lastMentioned).toMatchObject({ last: "2026-11-01", allTime: 1 });
    expect(out.reports.lastSeen.last).toBeUndefined();
  });
});
