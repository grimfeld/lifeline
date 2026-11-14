import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildLinkIndex, linkFieldLabel, PERSON_TYPE } from "@lifeline/core";
import type { Document, DocumentTypeDef, OwnedCommand } from "@lifeline/core";
import { calendarApp, EVENT_TYPE } from "@lifeline/app-calendar";
import { contactsApp } from "@lifeline/app-contacts";
import { timelineOf } from "../../apps/contacts/src/domain/timeline";

// calendar_add_event's With (#452): the tool call over the real manifests, core's store stood in for as in people.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const core = vi.hoisted(() => ({ putDocument: vi.fn() }));

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
    timedProviders: () => [],
    todayStr: () => "2026-11-14",
  };
});

// Core reads a link argument's candidates from its own store module, so it is stood in for there too.
vi.mock("../../packages/core/src/documents/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/store")>()),
  getDocument: async (id: string) => docs.get(id),
  allDocuments: async () => [...docs.values()],
  documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
}));

// …and so is the type registry it reads a link argument's noun ("Person") and a Document's aliases from.
vi.mock("../../packages/core/src/documents/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/registry")>()),
  documentTypeSync: (id: string) => types.get(id),
}));

const { runTool } = await import("./handlers");
const personTypeDef = contactsApp.types.find((t) => t.id === PERSON_TYPE)!;
const eventTypeDef = calendarApp.types.find((t) => t.id === EVENT_TYPE)!;

const person = (id: string, title: string, aliases: string[] = []) =>
  ({ id, type: PERSON_TYPE, title, folder: "People", tags: [], createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, aliases, relationship: "" }) as unknown as Document;

/** The Event the call stored, as putDocument was handed it. */
const stored = () => core.putDocument.mock.calls[0]![0] as Record<string, unknown>;

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  core.putDocument.mockReset().mockImplementation(async (input: Record<string, unknown>) => ({ id: "e1", folder: "", createdAt: "", updatedAt: "", deleted: 0, ...input }));
  types.set(PERSON_TYPE, personTypeDef);
  types.set(EVENT_TYPE, eventTypeDef);
  commands.push(...calendarApp.commands.map((c) => ({ ...c, appId: "calendar" })));
  docs.set("p1", person("p1", "Marc Lefèvre", ["Marco"]));
  docs.set("p2", person("p2", "Zoé Martin"));
  docs.set("p3", person("p3", "Marc Dubois"));
  docs.set("p4", person("p4", "Marc"));
});

describe("calendar_add_event with People", () => {
  it("stores the Person an alias names, and says whom it found", async () => {
    const out = await runTool("calendar_add_event", { title: "Dinner", date: "2026-11-14", with: ["Marco"] });
    expect(stored().with).toEqual(["p1"]);
    expect(out).toMatchObject({ id: "e1", message: "Added event “Dinner” on 2026-11-14 with Marc Lefèvre" });
  });

  it("names several People, each once, by name without accents or by id", async () => {
    docs.delete("p4");
    docs.delete("p3");
    docs.set("p1", person("p1", "Marc Lefèvre", ["Marco", "Marc"]));
    const out = await runTool("calendar_add_event", { title: "Dinner", date: "2026-11-14", with: ["Marc", "zoe martin", "Marco", "p1", "marc lefevre"] });
    expect(stored().with).toEqual(["p1", "p2"]);
    expect(out).toMatchObject({ message: "Added event “Dinner” on 2026-11-14 with Marc Lefèvre, Zoé Martin" });
  });

  it("refuses an unknown and an ambiguous name together, making no Event", async () => {
    docs.set("p1", person("p1", "Marc Lefèvre", ["Marco", "Marc"]));
    const call = runTool("calendar_add_event", { title: "Dinner", date: "2026-11-14", with: ["Bob", "Marc", "Zoé Martin"] });
    await expect(call).rejects.toThrow("With: No Person called “Bob”; With: “Marc” is more than one Person: Marc Lefèvre (id p1), Marc (id p4). Pass the id of the one meant");
    expect(core.putDocument).not.toHaveBeenCalled();
  });

  it("puts the Event on each Person's Timeline via With", async () => {
    await runTool("calendar_add_event", { title: "Dinner", date: "2026-11-14", with: ["Marco", "Zoé Martin"] });
    const event = { ...stored(), id: "e1", folder: "", createdAt: "", updatedAt: "", deleted: 0 } as unknown as Document;
    const index = buildLinkIndex([event, ...docs.values()], [...types.values()]);
    for (const id of ["p1", "p2"]) {
      const [entry] = timelineOf(index, id);
      expect(entry).toMatchObject({ sourceId: "e1", field: "with" });
      expect(`via ${linkFieldLabel(event, eventTypeDef, entry!.field!)}`).toBe("via With");
    }
  });

  it("without with, makes the Event as before, with no one", async () => {
    const out = await runTool("calendar_add_event", { title: "Dentist", date: "2026-11-14", start: "09:00" });
    expect(stored().with).toEqual([]);
    expect(out).toMatchObject({ message: "Added event “Dentist” on 2026-11-14 at 09:00" });
    await runTool("calendar_add_event", { title: "Dentist", date: "2026-11-14", with: [] });
    expect(core.putDocument.mock.calls[1]![0]).toMatchObject({ with: [] });
  });

  it("is listed as an array of strings taking ids, titles or aliases", async () => {
    const { TOOLS } = await import("./tools");
    const tool = TOOLS.find((t) => t.name === "calendar_add_event")!;
    const listed = z.toJSONSchema(z.object(tool.input)) as { properties: Record<string, { type?: string; items?: { type?: string }; description?: string }>; required?: string[] };
    expect(listed.properties.with).toMatchObject({ type: "array", items: { type: "string" } });
    expect(listed.properties.with!.description).toMatch(/ids, titles or aliases/);
    expect(listed.properties.with!.description).toMatch(/their name, an alias or an id; each must be only one Person/);
    expect(listed.required ?? []).not.toContain("with");
  });
});
