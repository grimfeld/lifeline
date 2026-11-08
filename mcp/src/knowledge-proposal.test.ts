import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getDocument, initApps, patchDocument, putDocument } from "@lifeline/core";
import { manifests } from "./apps";
import { runTool } from "./handlers";
import { TOOLS } from "./tools";

initApps(manifests);

async function topic(name: string) {
  return (await putDocument({ type: "language", title: name, name, newCap: 10, archived: false, tallies: [], folder: "", tags: [] })).id;
}

/** An accepted Word, as the user would have made it. */
async function acceptedWord(t: string, term: string, meaning: string) {
  const { id } = (await runTool("knowledge_word", { topic: t, term, meaning })) as { id: string };
  await patchDocument(id, { draft: false });
  return id;
}

describe("Knowledge: an agent proposes a rewrite (ADR 0115)", () => {
  it("stores the proposal on an accepted item and leaves the item itself alone", async () => {
    const t = await topic("Italian");
    const id = await acceptedWord(t, "stazione", "station");
    await runTool("knowledge_propose", { id, meaning: "railway station", notes: "feminine" });
    expect(await getDocument(id)).toMatchObject({ term: "stazione", meaning: "station", notes: "", proposal: { meaning: "railway station", notes: "feminine" } });
  });

  it("keeps one proposal per item: a newer one replaces the older", async () => {
    const t = await topic("French");
    const id = await acceptedWord(t, "gare", "station");
    await runTool("knowledge_propose", { id, meaning: "train station" });
    await runTool("knowledge_propose", { id, term: "la gare" });
    const w = (await getDocument(id)) as unknown as { proposal: Record<string, string>; meaning: string };
    expect(w.proposal).toEqual({ term: "la gare" });
    expect(w.meaning).toBe("station");
  });

  it("proposes for a Sentence and a Fact by their own fields", async () => {
    const t = await topic("History");
    const s = (await runTool("knowledge_sentence", { topic: t, text: "Vado {{a}} casa" })) as { id: string };
    const f = (await runTool("knowledge_fact", { topic: t, question: "Westphalia?", answer: "1648" })) as { id: string };
    await patchDocument(s.id, { draft: false });
    await patchDocument(f.id, { draft: false });
    await runTool("knowledge_propose", { id: s.id, text: "Vado {{a}} casa mia", translation: "I go to my house" });
    await runTool("knowledge_propose", { id: f.id, answer: "1648, Münster and Osnabrück" });
    expect(await getDocument(s.id)).toMatchObject({ text: "Vado {{a}} casa", proposal: { text: "Vado {{a}} casa mia", translation: "I go to my house" } });
    expect(await getDocument(f.id)).toMatchObject({ answer: "1648", proposal: { answer: "1648, Münster and Osnabrück" } });
  });

  it("updates a draft directly: a draft is the user's to review anyway", async () => {
    const t = await topic("Greek");
    const { id } = (await runTool("knowledge_word", { topic: t, term: "ναι", meaning: "yes" })) as { id: string };
    await runTool("knowledge_propose", { id, meaning: "yes (affirmative)" });
    const w = (await getDocument(id)) as unknown as { meaning: string; draft: boolean; proposal?: unknown };
    expect(w).toMatchObject({ meaning: "yes (affirmative)", draft: true });
    expect(w.proposal).toBeUndefined();
  });

  it("refuses what cannot be a rewrite, storing nothing", async () => {
    const t = await topic("Latin");
    const id = await acceptedWord(t, "aqua", "water");
    await expect(runTool("knowledge_propose", { id })).rejects.toThrow(/nothing to propose/i);
    await expect(runTool("knowledge_propose", { id, meaning: "water" })).rejects.toThrow(/nothing to propose/i);
    await expect(runTool("knowledge_propose", { id, question: "q" })).rejects.toThrow(/not a field of a Word/i);
    await expect(runTool("knowledge_propose", { id, meaning: "  " })).rejects.toThrow();
    await expect(runTool("knowledge_propose", { id: "nope", meaning: "x" })).rejects.toThrow();
    expect((await getDocument(id)) as unknown as { proposal?: unknown }).not.toHaveProperty("proposal");
  });

  it("refuses a Sentence rewrite that loses every blank", async () => {
    const t = await topic("Spanish");
    const s = (await runTool("knowledge_sentence", { topic: t, text: "Tengo {{ganas}}" })) as { id: string };
    await patchDocument(s.id, { draft: false });
    await expect(runTool("knowledge_propose", { id: s.id, text: "Tengo ganas" })).rejects.toThrow(/blank/);
  });

  it("is the only new tool, and cannot touch the proposal through update_document", async () => {
    expect(TOOLS.filter((t) => t.name.startsWith("knowledge_")).map((t) => t.name)).toContain("knowledge_propose");
    const t = await topic("German");
    const id = await acceptedWord(t, "Haus", "house");
    await expect(runTool("update_document", { id, fields: { proposal: { meaning: "x" } } })).rejects.toThrow();
  });
});
