import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { PERSON_TYPE, PLACE_TYPE, allDocumentTypes, allDocuments, createDocument, getDocument, initApps, pinsOf, putDocument, removeDocument } from "@lifeline/core";
import { manifests } from "./apps";
import { runTool } from "./handlers";

// An Event's At (ADR 0128), over the real store, as capture.test.ts runs it.
initApps(manifests);

let place = "";
let person = "";
beforeAll(async () => {
  place = (await createDocument({ type: PLACE_TYPE, title: "Chez Janou", folder: "Places", fields: { aliases: ["Janou"] } })).id;
  person = (await createDocument({ type: PERSON_TYPE, title: "Marc Lefèvre", folder: "People", fields: { aliases: ["Marco"] } })).id;
});

const add = async (args: Record<string, unknown>) => {
  const out = (await runTool("calendar_add_event", { title: "Dinner", date: "2026-11-20", ...args })) as { id: string; message: string };
  return { ...out, event: await getDocument(out.id) };
};
/**
 * Whether an answer gives `value`. A number counts only whole, not inside a longer
 * one: an answer's `updatedAt` ("…:32.384Z") holds "2.38" by chance about once in a
 * thousand stamps, which is not the Event's place.
 */
// A number counts only standing on its own: not inside a longer one, and not as the seconds of a
// time ("…T12:28:48.871Z" would give "48.87" whenever an answer was stamped at that second).
const gives = (answer: string, value: string): boolean =>
  /^-?\d+(\.\d+)?$/.test(value) ? new RegExp(`(?<![\\d.])(?<!\\d\\d:)${value.replace(".", "\\.")}`).test(answer) : answer.includes(value);

const agendaOn = async (day: string) => ((await runTool("agenda", { start: day, end: day })) as { days: Record<string, { title: string; at?: unknown }[]> }).days[day] ?? [];

describe("calendar_add_event's at", () => {
  it("sets At to a Place named by its title, its alias or its id", async () => {
    for (const at of ["Chez Janou", "janou", place]) {
      const { event, message } = await add({ start: "20:00", at });
      expect(event).toMatchObject({ type: "event", title: "Dinner", at: place });
      expect(message).toBe("Added event “Dinner” on 2026-11-20 at 20:00, At Chez Janou");
    }
  });

  it("sets At to a Person, meaning their home, by name or alias, and not With", async () => {
    for (const at of ["marc lefevre", "Marco"]) expect((await add({ title: "Feed the cat", at })).event).toMatchObject({ at: person, with: [] });
  });

  it("leaves At empty when not given", async () => {
    expect((await add({ title: "Dentist" })).event).toMatchObject({ at: "" });
  });

  it("refuses a name that is no Place or Person", async () => {
    await expect(add({ title: "Lost", date: "2026-11-21", at: "Bob" })).rejects.toThrow("At: No Place or Person called “Bob”");
    expect(await agendaOn("2026-11-21")).toEqual([]);
  });
});

describe("agenda names an Event's At", () => {
  it("as the Place's or the Person's id and title, and nothing for an Event at nowhere", async () => {
    await add({ title: "Supper", date: "2026-11-22", at: place });
    await add({ title: "Cat", date: "2026-11-22", at: person });
    await add({ title: "Nap", date: "2026-11-22" });
    const at = Object.fromEntries((await agendaOn("2026-11-22")).map((i) => [i.title, i.at]));
    expect(at).toEqual({ Supper: { id: place, title: "Chez Janou" }, Cat: { id: person, title: "Marc Lefèvre" }, Nap: undefined });
  });

  it("gives the Place's address and Kind beside it, as a search does, and a Person's id and title alone", async () => {
    const mori = (await createDocument({ type: PLACE_TYPE, title: "Mori Ramen", folder: "Places", fields: { kind: "restaurant", address: "18 Rue Sainte-Anne, Paris", geo: [48.8667, 2.3361] } })).id;
    await add({ title: "Ramen", date: "2026-11-27", at: mori });
    await add({ title: "Cat again", date: "2026-11-27", at: person });
    const at = Object.fromEntries((await agendaOn("2026-11-27")).map((i) => [i.title, i.at]));
    expect(at).toEqual({
      Ramen: { id: mori, title: "Mori Ramen", fields: { kind: "restaurant", address: "18 Rue Sainte-Anne, Paris" } },
      "Cat again": { id: person, title: "Marc Lefèvre" },
    });
  });

  it("names nothing once the Place is deleted", async () => {
    const gone = (await createDocument({ type: PLACE_TYPE, title: "Le Fermé", folder: "Places" })).id;
    await add({ title: "Lunch", date: "2026-11-23", at: gone });
    await removeDocument(gone);
    const items = await agendaOn("2026-11-23");
    expect(items.map((i) => [i.title, i.at])).toEqual([["Lunch", undefined]]);
    expect(JSON.stringify(items)).not.toContain("Le Fermé");
  });
});

describe("the agent wall: an Event At a Person (ADR 0114, ADR 0128)", () => {
  // Distinctive, so a hit is a leak, not a coincidence.
  const addresses = [
    { id: "a1", label: "Zanzibar house", text: "12 Rue Quillardet, 75019 Paris", lat: 48.871234, lon: 2.381234, former: false },
    { id: "a2", label: "Old flat Brixtonia", text: "4 Coldharbour Lane, London", lat: 51.461987, lon: -0.113456, former: true },
  ];
  const contactDetails = [{ id: "c1", label: "Mobile Qwz", kind: "phone", value: "+33 6 12 34 56 78", former: false }];
  const WALLED = [...addresses.flatMap((a) => [a.label, a.text, String(a.lat), String(a.lon)]), "+33 6 12 34 56 78", "Mobile Qwz", "addresses", "contactDetails"];

  let anne = "";
  let ev = "";
  let template = "";
  beforeAll(async () => {
    anne = (await putDocument({ type: PERSON_TYPE, title: "Anne Dupont", folder: "People", aliases: ["Mum"], addresses, contactDetails } as never)).id;
    ev = (await add({ title: "Tea at Mum's", date: "2026-11-24", start: "16:00", at: anne })).id;
    template = (await createDocument({ type: "event_template", title: "Tea", folder: "", fields: { allDay: true, durationMin: 60, defaultStart: "", notes: "" } })).id;
  });

  /** Every tool that can answer with an Event, or with something said of one. */
  const EVENT_TOOLS = (): { name: string; args: Record<string, unknown> }[] => [
    { name: "calendar_add_event", args: { title: "Tea again", date: "2026-11-25", at: "Anne Dupont" } },
    { name: "calendar_add_event", args: { title: "Tea by alias", date: "2026-11-25", at: "Mum" } },
    { name: "calendar_add_from_template", args: { template, date: "2026-11-26" } },
    { name: "agenda", args: { start: "2026-11-24", end: "2026-11-26" } },
    { name: "get_document", args: { id: ev } },
    { name: "search_documents", args: { type: "event" } },
    { name: "search_documents", args: { query: "Tea" } },
    { name: "search_documents", args: { query: "Quillardet" } },
    { name: "update_document", args: { id: ev, fields: { notes: "bring cake" } } },
    { name: "reschedule_timed", args: { appId: "calendar", itemId: ev, date: "2026-11-24", start: "17:00", end: "18:00" } },
    { name: "move_item", args: { appId: "calendar", itemId: ev, to: "2026-11-24" } },
  ];

  it("names the Person by id and title, and nothing of where they live, in every tool's answer", async () => {
    for (const { name, args } of EVENT_TOOLS()) {
      const answer = JSON.stringify(await runTool(name, args));
      for (const value of WALLED) expect(gives(answer, value), `${name} leaked “${value}”`).toBe(false);
    }
    const day = await agendaOn("2026-11-24");
    expect(day.find((i) => i.title === "Tea at Mum's")?.at).toEqual({ id: anne, title: "Anne Dupont" });
    expect(((await runTool("get_document", { id: ev })) as { fields: Record<string, unknown> }).fields.at).toBe(anne);
  });

  it("stands on the map at the Person's Address (#505), yet no tool's answer gives where, even rounded", async () => {
    const pins = pinsOf(await allDocuments(), allDocumentTypes(), ["event"], []).filter((p) => p.itemId === ev);
    expect(pins.map((p) => [p.name, p.lat, p.lon])).toEqual([["Tea at Mum's", 48.871234, 2.381234]]);
    const where = [...pins.flatMap((p) => [p.key, String(p.lat), String(p.lon)]), "48.87", "2.38", "locatableVia"];
    for (const { name, args } of EVENT_TOOLS()) {
      const answer = JSON.stringify(await runTool(name, args));
      for (const value of where) expect(gives(answer, value), `${name} located the Event: “${value}”`).toBe(false);
    }
  });

  it("finds no Event by the words of its Person's Address", async () => {
    expect(await runTool("search_documents", { query: "Quillardet" })).toMatchObject({ total: 0 });
  });
});
