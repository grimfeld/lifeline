import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { addAudioAttachment, allAttachments, getDocument, initApps, type DocumentTypeDef } from "@lifeline/core";
import { DECK, RECALL, SENTENCE, TOPIC, WORD, type Deck, type Item, type Sentence, type Word } from "../domain/types";
import { acceptDraft, acceptProposal, addDeck, addSentence, addWord, deckNamed, deleteItem, discardProposal, proposeChange, removeItemRecalls, setMembership, updateSentence, updateWord } from "./repo";

// The Knowledge types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], indexes: ["languageId"], builtIn: true }) as unknown as DocumentTypeDef;
initApps([{ id: "languages", title: "Knowledge", types: [TOPIC, WORD, SENTENCE, RECALL, DECK].map(bare), screens: [], cards: [], commands: [] }]);

const word = (id: string) => ({ id, type: WORD, languageId: "es" }) as Item;

describe("setMembership", () => {
  it("quick clicks from the same (stale) Deck keep every change", async () => {
    const id = await addDeck("es", "Kitchen");
    const stale = (await getDocument<Deck>(id))!;
    await Promise.all([setMembership(stale, word("w1"), true), setMembership(stale, word("w2"), true), setMembership(stale, word("w3"), true)]);
    expect((await getDocument<Deck>(id))!.members.sort()).toEqual(["w1", "w2", "w3"]);
    await setMembership(stale, word("w2"), false);
    expect((await getDocument<Deck>(id))!.members.sort()).toEqual(["w1", "w3"]);
  });
});

describe("acceptDraft", () => {
  it("clears the draft and adds the item from that moment, keeping its origin", async () => {
    const id = await addWord({ languageId: "es", term: "playa", meaning: "beach", origin: "Agent draft · Lesson 1", draft: true });
    const before = (await getDocument<Item & { draft?: boolean; addedAt: string; origin: string }>(id))!;
    expect(before.draft).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    await acceptDraft(id);
    const after = (await getDocument<Item & { draft?: boolean; addedAt: string; origin: string }>(id))!;
    expect(after.draft).toBe(false);
    expect(after.addedAt > before.addedAt).toBe(true);
    expect(after.origin).toBe("Agent draft · Lesson 1");
  });

  it("a deleted draft is simply gone", async () => {
    const id = await addWord({ languageId: "es", term: "mar", meaning: "sea", draft: true });
    await deleteItem(id);
    expect(await getDocument(id)).toBeUndefined();
  });
});

describe("deckNamed", () => {
  it("finds a Deck by name in its Topic, case ignored, else makes it there", async () => {
    const a = await deckNamed("fr", "Lesson 1");
    expect((await deckNamed("fr", "lesson 1")).id).toBe(a.id);
    expect((await deckNamed("es", "Lesson 1")).id).not.toBe(a.id);
  });
});

const audio = () => new Blob(["x"], { type: "audio/webm;codecs=opus" });
const clipsKept = async () => (await allAttachments()).map((a) => a.id).sort();

describe("a clip (ADR 0116)", () => {
  it("is kept with the Word, and an edit that leaves it out keeps it", async () => {
    const clip = (await addAudioAttachment(audio())).id;
    const id = await addWord({ languageId: "es", term: "nono", meaning: "grandfather", clip });
    const w = (await getDocument<Word>(id))!;
    expect(w.clip).toBe(clip);
    await updateWord(w, { languageId: "es", term: "nono", meaning: "grandpa" });
    expect((await getDocument<Word>(id))!.clip).toBe(clip);
    expect(await clipsKept()).toContain(clip);
  });

  it("replacing it removes the old Attachment", async () => {
    const first = (await addAudioAttachment(audio())).id;
    const second = (await addAudioAttachment(audio())).id;
    const id = await addWord({ languageId: "es", term: "nonno", meaning: "year", clip: first });
    await updateWord((await getDocument<Word>(id))!, { languageId: "es", term: "nonno", meaning: "year", clip: second });
    expect((await getDocument<Word>(id))!.clip).toBe(second);
    const kept = await clipsKept();
    expect(kept).toContain(second);
    expect(kept).not.toContain(first);
  });

  it("removing it from a Sentence leaves the Sentence, its blanks and no Attachment", async () => {
    const clip = (await addAudioAttachment(audio())).id;
    const id = await addSentence({ languageId: "es", text: "Tengo {{ganas}} de comer", clip });
    await updateSentence((await getDocument<Sentence>(id))!, { languageId: "es", text: "Tengo {{ganas}} de comer", clip: "" });
    expect(((await getDocument<Sentence>(id))!).clip).toBe("");
    expect(await clipsKept()).not.toContain(clip);
  });

  it("deleting the item takes its clip along", async () => {
    const clip = (await addAudioAttachment(audio())).id;
    const id = await addWord({ languageId: "es", term: "ciao", meaning: "hi", clip });
    const doc = (await getDocument<Word>(id))!;
    await removeItemRecalls(doc);
    await deleteItem(id);
    expect(await clipsKept()).not.toContain(clip);
  });
});

describe("a Sentence's notes", () => {
  it("are kept with the Sentence, and edited without touching its text", async () => {
    const id = await addSentence({ languageId: "it", text: "Vado {{nel|in}} centro", notes: "  also: in centro  " });
    const made = (await getDocument<Sentence>(id))!;
    expect(made.notes).toBe("also: in centro");
    await updateSentence(made, { languageId: "it", text: made.text, notes: "nel = in + il" });
    expect((await getDocument<Sentence>(id))!).toMatchObject({ notes: "nel = in + il", text: "Vado {{nel|in}} centro", title: "Vado nel centro" });
  });
});

describe("a proposed change (ADR 0115)", () => {
  const read = async <T,>(id: string) => (await getDocument<Item & T>(id))!;

  it("is stored beside the item, which keeps its values; a newer one replaces it", async () => {
    const id = await addWord({ languageId: "es", term: "casa", meaning: "house" });
    await proposeChange(await read(id), { meaning: "home" });
    await proposeChange(await read(id), { notes: "feminine" });
    expect(await read<{ meaning: string; proposal: object }>(id)).toMatchObject({ meaning: "house", proposal: { notes: "feminine" } });
  });

  it("accepted, applies as an ordinary edit and is gone; discarded, drops it and changes nothing", async () => {
    const id = await addWord({ languageId: "es", term: "casa", meaning: "house" });
    await proposeChange(await read(id), { meaning: "home" });
    await discardProposal(id);
    expect(await read<{ meaning: string; proposal?: object | null }>(id)).toMatchObject({ meaning: "house", proposal: null });
    await proposeChange(await read(id), { term: "la casa", meaning: "the home" });
    await acceptProposal(await read(id));
    expect(await read<{ term: string; meaning: string; title: string; proposal?: object | null }>(id)).toMatchObject({ term: "la casa", meaning: "the home", title: "la casa", proposal: null });
  });

  it("accepting a Sentence rewrite keeps the blanks it still has", async () => {
    const id = await addSentence({ languageId: "es", text: "Tengo {{ganas}} de {{comer}}" });
    await proposeChange(await read(id), { text: "Tengo {{ganas}} de {{beber}}" });
    await acceptProposal(await read(id));
    expect(await read<Sentence>(id)).toMatchObject({ text: "Tengo {{ganas}} de {{beber}}" });
  });

  it("refuses a rewrite the item could not hold", async () => {
    const id = await addSentence({ languageId: "es", text: "Tengo {{ganas}}" });
    await expect(proposeChange(await read(id), { text: "Tengo ganas" })).rejects.toThrow(/blank/);
  });
});
