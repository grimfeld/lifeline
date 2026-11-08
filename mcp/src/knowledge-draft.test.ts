import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { documentsOf as docsOf, getDocument, initApps, putDocument, type Document } from "@lifeline/core";

/** Documents of a type, read with the extra fields the test looks at. */
const documentsOf = <T extends object>(type: string) => docsOf<Document & T>(type);
import { manifests } from "./apps";
import { runTool } from "./handlers";
import { TOOLS } from "./tools";

initApps(manifests);

async function topic(name: string) {
  return (await putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] })).id;
}

describe("Knowledge captures through MCP are drafts", () => {
  it("makes a Word a draft, filed in a Deck created by name, with its origin", async () => {
    const t = await topic("Italian");
    const res = (await runTool("knowledge_word", { topic: t, term: "stazione", meaning: "station", deck: "Lesson 2", origin: "ep. 4" })) as { id: string };
    const w = (await getDocument(res.id)) as unknown as { draft: boolean; paused: boolean; origin: string };
    expect(w.draft).toBe(true);
    expect(w.paused).toBe(false);
    expect(w.origin).toBe("Agent draft · Lesson 2 · ep. 4");
    const decks = await documentsOf<{ name: string; languageId: string; members: string[] }>("language_deck");
    expect(decks.filter((d) => d.languageId === t).map((d) => [d.name, d.members])).toEqual([["Lesson 2", [res.id]]]);
  });

  it("has no way to say otherwise: a draft or paused argument is refused and nothing is made", async () => {
    const t = await topic("Greek");
    await expect(runTool("knowledge_word", { topic: t, term: "ναι", meaning: "yes", draft: false })).rejects.toThrow(/Unknown argument/);
    await expect(runTool("knowledge_fact", { topic: t, question: "q", answer: "a", paused: false })).rejects.toThrow(/Unknown argument/);
    expect((await documentsOf<{ languageId: string }>("language_word")).filter((w) => w.languageId === t)).toEqual([]);
  });

  it("reuses a Deck of that name in the Topic, whatever its case", async () => {
    const t = await topic("French");
    const a = (await runTool("knowledge_word", { topic: t, term: "gare", meaning: "station", deck: "Gares" })) as { id: string };
    const b = (await runTool("knowledge_word", { topic: t, term: "quai", meaning: "platform", deck: "gares" })) as { id: string };
    const decks = (await documentsOf<{ languageId: string; members: string[] }>("language_deck")).filter((d) => d.languageId === t);
    expect(decks).toHaveLength(1);
    expect([...decks[0]!.members].sort()).toEqual([a.id, b.id].sort());
  });

  it("drafts a Sentence and a Fact too, with a plain origin when no Deck or note is given", async () => {
    const t = await topic("History");
    const s = (await runTool("knowledge_sentence", { topic: t, text: "Vado {{alla}} stazione" })) as { id: string };
    const f = (await runTool("knowledge_fact", { topic: t, question: "Westphalia?", answer: "1648" })) as { id: string };
    expect(await getDocument(s.id)).toMatchObject({ draft: true, origin: "Agent draft" });
    expect(await getDocument(f.id)).toMatchObject({ draft: true, origin: "Agent draft" });
  });

  it("cannot be accepted, paused or unpaused through update_document: those fields are guarded", async () => {
    const t = await topic("Latin");
    const w = (await runTool("knowledge_word", { topic: t, term: "aqua", meaning: "water" })) as { id: string };
    for (const fields of [{ draft: false }, { paused: true }]) {
      await expect(runTool("update_document", { id: w.id, fields })).rejects.toThrow();
    }
    expect(await getDocument(w.id)).toMatchObject({ draft: true });
  });

  it("offers no tool that accepts, pauses, unpauses or deletes, and no argument to skip drafting", () => {
    const names = TOOLS.map((t) => t.name).filter((n) => n.startsWith("knowledge_"));
    expect(names.filter((n) => /accept|pause|delete|remove/.test(n))).toEqual([]);
    for (const n of ["knowledge_word", "knowledge_sentence", "knowledge_fact"]) {
      const keys = Object.keys(TOOLS.find((t) => t.name === n)!.input);
      expect(keys).toEqual(expect.arrayContaining(["topic", "deck", "origin"]));
      expect(keys).not.toContain("draft");
      expect(keys).not.toContain("paused");
    }
  });
});
