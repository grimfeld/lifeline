// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, initApps, invokeCommand } from "@lifeline/core";
import { workTypeDefs, authorRole, authorTypeDef } from "./types";
import { libraryParts } from "./parts";
import { libraryStateCommands } from "./stateCommands";
import { addWork, allWorks, ensureAuthor, patchWork } from "./data/repo";

initApps([{ id: "library", title: "Library", types: [...workTypeDefs, authorTypeDef, ...libraryParts.typeDefs], roles: [authorRole], screens: [], cards: [], commands: [] }]);

const cmd = (id: string) => libraryStateCommands.find((c) => c.id === id)!;
const run = (id: string, args: Record<string, unknown>) => invokeCommand(cmd(id), args);
const get = async (id: string) => (await allWorks()).find((w) => w.id === id)!;
const add = (title: string, medium: "book" | "comic" = "book") => addWork({ medium, title, acquisition: "WANTED", reason: "" });

beforeEach(async () => {
  await documentsTable().clear();
});

describe("library.shelf", () => {
  it("starts, finishes (freeing the slot) and drops, as the buttons do", async () => {
    const id = await add("Dune");
    await run("library.nightstand", { work: "Dune", on: true });
    await run("library.shelf", { work: "Dune", shelf: "IN_PROGRESS" });
    let w = await get(id);
    expect([w.engagement, w.startedOn !== "", w.slot]).toEqual(["IN_PROGRESS", true, 1]);
    await run("library.shelf", { work: id, shelf: "DONE", finishedOn: "2026-01-02" });
    w = await get(id);
    expect([w.engagement, w.finishedOn, w.slot, w.slottedOn]).toEqual(["DONE", "2026-01-02", 0, ""]);
    await run("library.shelf", { work: id, shelf: "ABANDONED" });
    expect((await get(id)).engagement).toBe("ABANDONED");
  });
  it("To read is the buttons' “Mark … again”: the started and finished days are cleared", async () => {
    const id = await add("Dune");
    await run("library.shelf", { work: id, shelf: "IN_PROGRESS" });
    await run("library.shelf", { work: id, shelf: "DONE", finishedOn: "2026-01-02" });
    await run("library.shelf", { work: id, shelf: "UNSTARTED" });
    const w = await get(id);
    expect([w.engagement, w.startedOn, w.finishedOn]).toEqual(["UNSTARTED", "", ""]);
  });
  it("Done back to In progress keeps the started day", async () => {
    const id = await add("Dune");
    await run("library.shelf", { work: id, shelf: "IN_PROGRESS" });
    const started = (await get(id)).startedOn;
    await run("library.shelf", { work: id, shelf: "DONE" });
    await run("library.shelf", { work: id, shelf: "IN_PROGRESS" });
    const w = await get(id);
    expect([w.engagement, w.startedOn, w.finishedOn]).toEqual(["IN_PROGRESS", started, ""]);
  });
  it("refuses a finished date off the Done shelf", async () => {
    await add("Dune");
    await expect(run("library.shelf", { work: "Dune", shelf: "ABANDONED", finishedOn: "2026-01-02" })).rejects.toThrow(/Done/);
  });
});

describe("library.acquisition", () => {
  it("moves Wanted, Owned, Borrowed and Gone", async () => {
    const id = await add("Dune");
    await run("library.acquisition", { work: "Dune", acquisition: "OWNED" });
    expect([(await get(id)).acquisition, (await get(id)).acquiredOn !== ""]).toEqual(["OWNED", true]);
    await run("library.acquisition", { work: "Dune", acquisition: "GONE" });
    expect((await get(id)).acquisition).toBe("GONE");
    await run("library.acquisition", { work: "Dune", acquisition: "WANTED" });
    expect([(await get(id)).acquisition, (await get(id)).acquiredOn]).toEqual(["WANTED", ""]);
  });
});

describe("library.nightstand", () => {
  it("refuses when the medium's slots are full, naming the holders", async () => {
    for (const t of ["A", "B", "C"]) {
      await add(t, "comic");
      await run("library.nightstand", { work: t, on: true });
    }
    await add("D", "comic");
    await expect(run("library.nightstand", { work: "D", on: true })).rejects.toThrow(/“A”, “B”, “C”/);
    await run("library.nightstand", { work: "A", on: false });
    await run("library.nightstand", { work: "D", on: true });
    expect((await allWorks()).find((w) => w.title === "D")!.slot).toBe(1);
  });
});

describe("library.catch-up and library.get", () => {
  it("moves the position, and get reports it", async () => {
    const id = await add("Dune");
    await patchWork(await get(id), { partCount: 10 });
    await patchWork(await get(id), { authors: [await ensureAuthor({ name: "Frank Herbert" })] });
    await run("library.catch-up", { work: "Dune", part: 4 });
    const w = await get(id);
    expect([w.caughtUpPart, w.engagement]).toEqual([4, "IN_PROGRESS"]);
    const { message } = await run("library.get", { work: "Dune" });
    expect(message).toContain("Frank Herbert");
    expect(message).toContain("Progress: 4 of 10 chapters read");
    expect(message).toContain("Shelf: In progress");
    await run("library.catch-up", { work: "Dune", part: 0 });
    expect((await get(id)).caughtUpPart).toBe(0);
  });
});

describe("library.get", () => {
  it("shows the synopsis, the series and its number, the original title and language, the cover and the external key", async () => {
    const id = await addWork({ medium: "manga", title: "Akira", acquisition: "WANTED", reason: "", externalKey: "openlibrary:/works/OL9W", coverUrl: "https://c/akira.jpg", synopsis: "Neo-Tokyo burns.", series: "Akira", seriesNumber: 2, originalTitle: "アキラ", originalLanguage: "Japanese" });
    const { message } = await run("library.get", { work: id });
    for (const line of ["Synopsis: Neo-Tokyo burns.", "Series: Akira #2", "Original title: アキラ", "Original language: Japanese", "Cover: https://c/akira.jpg", "External key: openlibrary:/works/OL9W"]) expect(message).toContain(line);
  });
});

