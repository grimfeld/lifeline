import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, getDocument, initApps, putDocument, removeDocument } from "@lifeline/core";
import { writerApp } from "@lifeline/app-writer";
import { chapterType, manuscriptType, outtakeType } from "../types";
import { CHAPTER, MANUSCRIPTS_FOLDER, OUTTAKE, type Chapter, type Outtake } from "../domain/types";
import { defaultChapterTitle, nextPosition, wordCount } from "../domain/order";
import { addChapter, cutToOuttake, moveChapterBy, newManuscript, restoreOuttake } from "./repo";

initApps([
  writerApp,
  { id: "manuscript", title: "Manuscripts", types: [manuscriptType, chapterType, outtakeType], screens: [], cards: [], commands: [] },
]);

const chapter = async (id: string) => (await getDocument<Chapter>(id))!;
const outtakes = async () => documentsOf<Outtake>(OUTTAKE);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("order helpers", () => {
  it("count words, place a new Chapter last and name it by count", () => {
    expect(wordCount(" a b\nc ")).toBe(3);
    expect(nextPosition([])).toBe(1);
    expect(nextPosition([{ position: 3 }, { position: 1 }])).toBe(4);
    expect(defaultChapterTitle(2)).toBe("Chapter 3");
  });
});

describe("Chapters", () => {
  it("are added at the end, as Chapter N, in the Manuscript's own folder", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const one = await addChapter(m.id);
    const two = await addChapter(m.id, " Storm ");
    expect([one.title, one.position, one.folder]).toEqual(["Chapter 1", 1, `${MANUSCRIPTS_FOLDER}/The Sea`]);
    expect([two.title, two.position]).toEqual(["Storm", 2]);
  });

  it("take a free name inside their folder, while another Manuscript's may share it", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const other = await newManuscript({ title: "The Hill" });
    await addChapter(m.id, "Storm");
    expect((await addChapter(m.id, "storm")).title).toBe("storm (2)");
    expect((await addChapter(other.id, "Storm")).title).toBe("Storm");
  });

  it("refuse a Manuscript that is not there", async () => {
    await expect(addChapter("nope")).rejects.toThrow("isn't here");
  });

  it("move up and down, renumbered", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const a = await addChapter(m.id);
    const b = await addChapter(m.id);
    await moveChapterBy(m.id, b.id, -1);
    expect([(await chapter(b.id)).position, (await chapter(a.id)).position]).toEqual([1, 2]);
  });

  it("go, with their Outtakes, when the Manuscript goes", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const c = await addChapter(m.id);
    await putDocument({ ...(await chapter(c.id)), body: "Keep. Cut me." });
    await cutToOuttake(c.id, "Cut me.");
    await removeDocument(m.id);
    expect(await documentsOf(CHAPTER)).toEqual([]);
    expect(await outtakes()).toEqual([]);
  });
});

describe("Outtakes (CONTEXT.md)", () => {
  it("take a passage out of the Chapter and keep it with the Manuscript", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const c = await addChapter(m.id);
    await putDocument({ ...(await chapter(c.id)), body: "One.\n\nTwo.\n\nThree." });
    const o = await cutToOuttake(c.id, " Two. ");
    expect((await chapter(c.id)).body).toBe("One.\n\nThree.");
    expect(o).toMatchObject({ body: "Two.\n", manuscriptId: m.id, chapterId: c.id });
    expect(outtakeType.titleOf!(o)).toBe("Two.");
  });

  it("refuse a passage that is not in the text", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const c = await addChapter(m.id);
    await expect(cutToOuttake(c.id, "missing")).rejects.toThrow("Select the passage");
  });

  it("go back at the end of a Chapter, and are let go", async () => {
    const m = await newManuscript({ title: "The Sea" });
    const c = await addChapter(m.id);
    await putDocument({ ...(await chapter(c.id)), body: "One.\n\nTwo.\n" });
    const o = await cutToOuttake(c.id, "Two.");
    await restoreOuttake(o.id, c.id);
    expect((await chapter(c.id)).body).toBe("One.\n\nTwo.\n");
    expect(await outtakes()).toEqual([]);
  });
});
