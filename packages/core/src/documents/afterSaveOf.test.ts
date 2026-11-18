import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initApps } from "../registry";
import { documentsOf, documentsTable, getDocument, patchDocument, putDocument } from "./store";
import type { Document, DocumentTypeDef } from "./types";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({ id, label: id + "s", titleRule: "name", body: "optional", fields: [], builtIn: true, ...extra });
const seen: string[] = [];
// A "spot" keeps a count of the "trip"s saved, as Atlas keeps To try after an Event (ADR 0121).
const spot = T("spot", {
  afterSaveOf: {
    of: ["trip"],
    async run(saved: Document) {
      seen.push(`${saved.title}@${String(saved.date)}`);
      for (const s of await documentsOf("spot")) await patchDocument(s.id, { trips: seen.length });
    },
  },
});
const broken = T("broken", { afterSaveOf: { of: ["trip"], run: () => Promise.reject(new Error("boom")) } });
initApps([{ id: "t", title: "T", types: [spot, broken, T("trip"), T("note")], screens: [], cards: [], commands: [] }]);

beforeEach(async () => {
  await documentsTable().clear();
  seen.length = 0;
});

describe("a type told when another type's Document is saved (ADR 0121)", () => {
  it("is called with the Document as written, after a put and after a patch", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = await putDocument({ type: "spot", title: "Home" });
    const trip = await putDocument({ type: "trip", title: "Lyon", date: "2026-11-10" });
    await patchDocument(trip.id, { date: "2026-11-12" });
    expect(seen).toEqual(["Lyon@2026-11-10", "Lyon@2026-11-12"]);
    expect(await getDocument(s.id)).toMatchObject({ trips: 2 });
  });

  it("is not called for a type it does not name", async () => {
    await putDocument({ type: "note", title: "Saturday" });
    expect(seen).toEqual([]);
  });

  it("never fails the save it follows", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const trip = await putDocument({ type: "trip", title: "Arles", date: "2026-11-01" });
    expect(await getDocument(trip.id)).toMatchObject({ title: "Arles" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken after saving trip"), expect.any(Error));
  });
});
