import { describe, expect, it } from "vitest";
import type { MaterialDoc } from "./material";
import { FORWARD, LISTEN, REVERSE, isBlankSlot, itemMaterial, promptText } from "./prompts";
import { FACT, SENTENCE, WORD, type Fact, type Sentence, type Word } from "./types";

const base = { tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, languageId: "it", notes: "", origin: "", originId: "", paused: false, addedAt: "2026-09-01" };
const docOf = (item: Word | Sentence | Fact): MaterialDoc => ({ ...itemMaterial(item), doc: item });
const word = docOf({ ...base, id: "w", type: WORD, title: "stazione", term: "stazione", meaning: "station", clip: "c1" } as Word);
const sentence = docOf({ ...base, id: "s", type: SENTENCE, title: "s", text: "Vado {{alla|a}} {{stazione}}", translation: "I go to the station", clip: "c2" } as Sentence);
const fact = docOf({ ...base, id: "f", type: FACT, title: "t", question: "When?", answer: "1648" } as Fact);

describe("a Prompt's question and answer", () => {
  it("a Word's forward asks the term, answers the meaning; its reverse the other way round", () => {
    expect(promptText(word, FORWARD)).toEqual({ question: "stazione", answer: "station" });
    expect(promptText(word, REVERSE)).toEqual({ question: "station", answer: "stazione" });
  });
  it("a Sentence's blank is open with its hint, the others filled; the answer is the blank's text", () => {
    expect(promptText(sentence, "blank:alla")).toEqual({ question: "Vado ____ (a) stazione", answer: "alla" });
    expect(promptText(sentence, "blank:stazione")).toEqual({ question: "Vado alla ____", answer: "stazione" });
  });
  it("a Fact asks its question and answers its answer", () => {
    expect(promptText(fact, FORWARD)).toEqual({ question: "When?", answer: "1648" });
  });
  it("a listening Prompt answers with the term (Word) or the whole sentence, as the face shows it", () => {
    expect(promptText(word, LISTEN)).toEqual({ question: "(listen)", answer: "stazione" });
    expect(promptText(sentence, LISTEN)).toEqual({ question: "(listen)", answer: "Vado alla stazione" });
  });
  it("another App's material is its title, with no answer", () => {
    const quote: MaterialDoc = { ...word, type: "notes_quote", title: "Carpe diem", doc: { ...word.doc, type: "notes_quote" } };
    expect(promptText(quote, FORWARD)).toEqual({ question: "Carpe diem", answer: null });
  });
});

describe("blank slots", () => {
  it("are told by their prefix, not by their text", () => {
    expect(isBlankSlot("blank:alla")).toBe(true);
    expect(isBlankSlot("blank:alla#2")).toBe(true);
    expect(isBlankSlot(FORWARD)).toBe(false);
    expect(isBlankSlot(LISTEN)).toBe(false);
  });
});
