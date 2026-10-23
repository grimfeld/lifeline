import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, getDocument, initApps, putDocument, removeDocument } from "@lifeline/core";
import { ESSAY, VERSION, essayType, versionType, wordCount, type Essay, type Version } from "./types";
import { newEssay, restore, setPinned, snapshot } from "./data";

initApps([{ id: "writer", title: "Research", types: [essayType, versionType], screens: [], cards: [], commands: [] }]);

const versions = async () => documentsOf<Version>(VERSION);
const essay = async (id: string) => (await getDocument<Essay>(id))!;

beforeEach(async () => {
  await documentsTable().clear();
});

describe("wordCount", () => {
  it("counts words between any whitespace", () => {
    expect(wordCount("  one two\n\nthree\tfour ")).toBe(4);
    expect(wordCount(" \n ")).toBe(0);
  });
});

describe("a Version", () => {
  it("is titled by its label, else by when it was taken", () => {
    expect(versionType.titleOf!({ label: "first draft", takenAt: "2026-10-23T09:30:12Z" } as never)).toBe("first draft");
    expect(versionType.titleOf!({ label: "", takenAt: "2026-10-23T09:30:12Z" } as never)).toBe("Version 2026-10-23 09:30");
  });

  it("snapshots the body as it is, with its word count, in the Essay's folder", async () => {
    const e = await newEssay({ title: "On walls", tags: ["Thesis"] });
    expect(e).toMatchObject({ type: ESSAY, status: "draft", material: [], tags: ["thesis"] });
    const v = await snapshot({ ...e, body: "Walls keep things in." }, "  first ");
    expect(v).toMatchObject({ writingId: e.id, label: "first", words: 4, body: "Walls keep things in.", folder: e.folder });
  });

  it("goes down with its Essay", async () => {
    const e = await newEssay({ title: "On walls" });
    await snapshot(e);
    await removeDocument(e.id);
    expect(await versions()).toEqual([]);
  });
});

describe("restoring a Version", () => {
  it("snapshots the current text first, so nothing is lost", async () => {
    const e = await newEssay({ title: "On walls" });
    const old = await snapshot({ ...e, body: "Old text." });
    await putDocument({ ...(await essay(e.id)), body: "New text." });
    await restore(await essay(e.id), old);
    expect((await essay(e.id)).body).toBe("Old text.");
    expect((await versions()).find((v) => v.label === "before restore")?.body).toBe("New text.");
  });

  it("takes no snapshot when the text is already that Version's", async () => {
    const e = await newEssay({ title: "On walls" });
    await putDocument({ ...(await essay(e.id)), body: "Same." });
    const v = await snapshot(await essay(e.id));
    await restore(await essay(e.id), v);
    expect(await versions()).toHaveLength(1);
  });
});

describe("pinned material (ADR 0068)", () => {
  it("pins a Document once and takes it off again", async () => {
    const e = await newEssay({ title: "On walls" });
    await setPinned(e.id, "src1", true);
    await setPinned(e.id, "src1", true);
    await setPinned(e.id, "src2", true);
    expect((await essay(e.id)).material).toEqual(["src1", "src2"]);
    await setPinned(e.id, "src1", false);
    expect((await essay(e.id)).material).toEqual(["src2"]);
  });
});
