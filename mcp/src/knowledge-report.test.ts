import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { documentsOf as docsOf, initApps, putDocument, type Document } from "@lifeline/core";
import { manifests } from "./apps";
import { runTool } from "./handlers";
import { TOOLS } from "./tools";

initApps(manifests);

const documentsOf = <T extends object>(type: string) => docsOf<Document & T>(type);
const day = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString();

async function topic(name: string) {
  return (await putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] })).id;
}

async function word(languageId: string, term: string, meaning: string, extra: Record<string, unknown> = {}) {
  return (await putDocument({ type: "language_word", title: term, languageId, term, meaning, notes: "", origin: "", originId: "", paused: false, addedAt: day(40), folder: "", tags: [], ...extra })).id;
}

async function recall(languageId: string, itemId: string, slot: string, grade: "pass" | "fail", back: number, typed?: string) {
  await putDocument({ type: "language_recall", title: `${grade} ${slot}`, languageId, itemId, slot, grade, at: day(back), folder: "", tags: [], ...(typed === undefined ? {} : { typed }) });
}

async function deck(languageId: string, name: string, members: string[]) {
  return (await putDocument({ type: "language_deck", title: name, languageId, name, members, folder: "", tags: [] })).id;
}

type Report = { topic: string; decks: string[]; retention: { passed: number; total: number; share: number } | null; dueToday: number; newWaiting: number; mostFailed: { itemId: string; slot: string; question: string; answer: string; fails: number; recalls: { grade: string; at: string }[] }[] };

describe("knowledge_report", () => {
  it("is a read-only tool taking a Topic and optional Decks", () => {
    const t = TOOLS.find((x) => x.name === "knowledge_report")!;
    expect(t.write).toBe(false);
    expect(t.description).toMatch(/Retention/);
    expect(Object.keys(t.input)).toEqual(expect.arrayContaining(["topic", "decks"]));
  });

  it("reads Retention, what is due, and the Prompts failed most, with their Recalls", async () => {
    const t = await topic("Italian");
    const a = await word(t, "stazione", "station");
    await recall(t, a, "reverse", "pass", 20);
    await recall(t, a, "reverse", "fail", 10);
    await recall(t, a, "reverse", "fail", 5);
    const r = (await runTool("knowledge_report", { topic: "italian" })) as Report;
    expect(r.topic).toBe("Italian");
    expect(r.retention).toEqual({ passed: 0, total: 2, share: 0 });
    expect(r.dueToday).toBe(1);
    expect(r.mostFailed).toHaveLength(1);
    expect(r.mostFailed[0]).toMatchObject({ itemId: a, slot: "reverse", question: "station", answer: "stazione", fails: 2 });
    expect(r.mostFailed[0]!.recalls.map((x) => x.grade)).toEqual(["fail", "fail", "pass"]);
    // Recalls are an internal type: the report gives their grade and moment, not Documents.
    expect(Object.keys(r.mostFailed[0]!.recalls[0]!).sort()).toEqual(["at", "grade"]);
  });

  it("gives the typed attempt of each Recall that has one", async () => {
    const t = await topic("Italian typed");
    const a = await word(t, "stazione", "station");
    await recall(t, a, "reverse", "fail", 3, "a la stazione");
    await recall(t, a, "reverse", "fail", 2);
    const r = (await runTool("knowledge_report", { topic: "Italian typed" })) as Report;
    expect(r.mostFailed[0]!.recalls.map((x) => (x as { typed?: string }).typed)).toEqual([undefined, "a la stazione"]);
  });

  it("leaves drafts, paused material and Recalls of other Topics out", async () => {
    const t = await topic("Greek");
    const other = await topic("Latin");
    const draft = await word(t, "ναι", "yes", { draft: true });
    const paused = await word(t, "όχι", "no", { paused: true });
    const own = await word(t, "νερό", "water");
    for (const id of [draft, paused, own]) {
      await recall(t, id, "forward", "pass", 20);
      await recall(t, id, "forward", "fail", 3);
    }
    const stray = await word(other, "aqua", "water");
    await recall(other, stray, "forward", "fail", 2);
    await recall(other, stray, "forward", "fail", 1);
    const r = (await runTool("knowledge_report", { topic: t })) as Report;
    expect(r.mostFailed.map((p) => p.itemId)).toEqual([own]);
    expect(r.retention).toEqual({ passed: 0, total: 1, share: 0 });
  });

  it("narrows to Decks, and refuses an unknown Topic or Deck", async () => {
    const t = await topic("French");
    const a = await word(t, "gare", "station");
    const b = await word(t, "quai", "platform");
    for (const id of [a, b]) {
      await recall(t, id, "forward", "pass", 20);
      await recall(t, id, "forward", "fail", 3);
    }
    await deck(t, "Lesson 1", [a]);
    await deck(t, "Lesson 2", [b]);
    const one = (await runTool("knowledge_report", { topic: t, decks: ["lesson 1"] })) as Report;
    expect(one.decks).toEqual(["Lesson 1"]);
    expect(one.mostFailed.map((p) => p.itemId)).toEqual([a]);
    const both = (await runTool("knowledge_report", { topic: t, decks: ["Lesson 1", "Lesson 2"] })) as Report;
    expect(both.mostFailed).toHaveLength(2);
    await expect(runTool("knowledge_report", { topic: "Klingon" })).rejects.toThrow(/No Topic “Klingon”.*French/);
    await expect(runTool("knowledge_report", { topic: t, decks: ["Nope"] })).rejects.toThrow(/No Deck “Nope”.*Lesson 1/);
  });

  it("changes nothing", async () => {
    const t = await topic("Spanish");
    const a = await word(t, "casa", "house");
    await recall(t, a, "forward", "fail", 2);
    const before = JSON.stringify(await documentsOf("language_recall"));
    await runTool("knowledge_report", { topic: t });
    expect(JSON.stringify(await documentsOf("language_recall"))).toBe(before);
  });
});
