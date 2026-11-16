import "fake-indexeddb/auto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PLACE_TYPE, createDocument, getDocument, initApps } from "@lifeline/core";
import { settleToTry } from "@lifeline/app-atlas/src/data/repo";
import { manifests } from "./apps";
import { runTool } from "./handlers";

// To try (ADR 0119) over the real store: whoever marks it, Core's save hook keeps its day (ADR 0123).
initApps(manifests);

beforeAll(() => vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 15, 12) }));
afterAll(() => vi.useRealTimers());

describe("update_document marking a visited Place To try again", () => {
  it("keeps the mark when the Place is opened, and when an older visit is saved", async () => {
    const janou = (await createDocument({ type: PLACE_TYPE, title: "Chez Janou", folder: "Places", fields: { toTry: false } })).id;
    await runTool("calendar_add_event", { title: "Dinner", date: "2026-10-10", at: janou });
    expect(await runTool("update_document", { id: janou, fields: { toTry: true } })).toMatchObject({ message: "Updated toTry" });
    expect(await getDocument(janou)).toMatchObject({ toTry: true, toTrySince: "2026-11-15" });
    await settleToTry(janou);
    expect((await getDocument(janou))?.toTry).toBe(true);
    await runTool("calendar_add_event", { title: "Lunch", date: "2026-10-20", at: janou });
    expect((await getDocument(janou))?.toTry).toBe(true);
    // A visit since it was marked clears it, once it has happened.
    vi.setSystemTime(new Date(2026, 10, 17, 12));
    await runTool("calendar_add_event", { title: "Supper", date: "2026-11-16", at: janou });
    expect((await getDocument(janou))?.toTry).toBe(false);
  });
});
