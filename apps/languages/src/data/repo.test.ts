import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { getDocument, initApps, type DocumentTypeDef } from "@lifeline/core";
import { DECK, RECALL, SENTENCE, TOPIC, WORD, type Deck, type Item, type Sentence } from "../domain/types";
import { addDeck, addSentence, setMembership, updateSentence } from "./repo";

// The Knowledge types, bare: the App manifest pulls in screens that need a DOM.
const bare = (id: string) => ({ id, label: id, titleRule: "name", body: "optional", fields: [], builtIn: true }) as unknown as DocumentTypeDef;
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

describe("a Sentence's notes", () => {
  it("are kept with the Sentence, and edited without touching its text", async () => {
    const id = await addSentence({ languageId: "it", text: "Vado {{nel|in}} centro", notes: "  also: in centro  " });
    const made = (await getDocument<Sentence>(id))!;
    expect(made.notes).toBe("also: in centro");
    await updateSentence(made, { languageId: "it", text: made.text, notes: "nel = in + il" });
    expect((await getDocument<Sentence>(id))!).toMatchObject({ notes: "nel = in + il", text: "Vado {{nel|in}} centro", title: "Vado nel centro" });
  });
});
