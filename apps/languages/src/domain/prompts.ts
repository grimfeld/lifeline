import { BLANK_PREFIX, blankSlots, parseCloze, plainSentence } from "./cloze";
import { inPractice } from "./draft";
import { isTyped, type MaterialDoc } from "./material";
import { FACT, SENTENCE, WORD, type Item, type Material } from "./types";

/**
 * A Prompt (CONTEXT.md "Prompt"): one question derived from a Recallable
 * Document. Never stored — identified by its Document and slot, which is
 * what a Recall points at.
 */
export interface Prompt {
  /** `${itemId}|${slot}` */
  key: string;
  itemId: string;
  slot: string;
  topicId: string;
  /** Ordering for "oldest added first": the Document's addedAt, then its slot order. */
  addedAt: string;
  order: number;
}

export function promptKey(itemId: string, slot: string): string {
  return `${itemId}|${slot}`;
}

/** The listening Prompt's slot (ADR 0116): the same whichever clip, so a re-recording keeps its schedule. */
export const LISTEN = "listen";
/** A Word's two directions, and a Fact's only slot. */
export const FORWARD = "forward";
export const REVERSE = "reverse";
/** Whether a slot is a Sentence's blank (cloze.ts builds them). */
export const isBlankSlot = (slot: string): boolean => slot.startsWith(BLANK_PREFIX);

/**
 * The slots of Knowledge's own types: a Word's forward and reverse, one per
 * blank of a Sentence, a Fact's one forward — and `listen` last, only while a
 * Word or Sentence carries a clip. Without the clip its Recalls stay, counting
 * for nothing.
 */
export function itemSlots(item: Item): string[] {
  if (item.type === FACT) return [FORWARD];
  const listen = (item as { clip?: string }).clip ? [LISTEN] : [];
  if (item.type === WORD) return [FORWARD, REVERSE, ...listen];
  return item.type === SENTENCE ? [...blankSlots(item.text ?? ""), ...listen] : [];
}

/** A Word or Sentence read as Material — the same reading its Recallable declaration gives. */
export function itemMaterial(item: Item): Material {
  return { id: item.id, type: item.type, title: item.title, topicId: item.languageId, addedAt: item.addedAt, live: inPractice(item), slots: itemSlots(item), originId: item.originId ?? "" };
}

/** Every Prompt a piece of Material yields. */
export function promptsOf(m: Material): Prompt[] {
  return m.slots.map((slot, order) => ({ key: promptKey(m.id, slot), itemId: m.id, slot, topicId: m.topicId, addedAt: m.addedAt, order }));
}

/** How a Word, Sentence or Fact reads in a list: its main line (term, sentence, question) and what glosses it. */
export function itemLines(item: Item): { main: string; sub: string } {
  if (item.type === SENTENCE) return { main: plainSentence(item.text ?? ""), sub: item.translation ?? "" };
  if (item.type === FACT) return { main: item.question || item.title, sub: item.answer ?? "" };
  return { main: item.term || item.title, sub: item.meaning ?? "" };
}

/**
 * Where the user may type an attempt before revealing (ADR 0116): a Word's
 * reverse, a Sentence's blank and either's listening Prompt — answers short and exact. A forward Word and
 * a Fact are paraphrases, reveal-only.
 */
export function isTypeable(type: string, slot: string): boolean {
  switch (type) {
    case WORD:
      return slot === REVERSE || slot === LISTEN;
    case SENTENCE:
      return isBlankSlot(slot) || slot === LISTEN;
    default:
      return false;
  }
}

/** What a listening Prompt asks, where there is nothing to read. */
export const LISTEN_QUESTION = "(listen)";

/**
 * A Prompt's question and answer: the one derivation faces, Practice, the
 * Leech list and the report all read. A listening Prompt's answer is what was
 * said — a Word's term, a Sentence whole — and a Word's face adds the meaning
 * beside it. Another App's Recallable is read by its title, with no answer.
 */
export function promptText(m: MaterialDoc, slot: string): { question: string; answer: string | null } {
  return isTyped(m) ? itemPromptText(m.doc, slot) : { question: m.title, answer: null };
}

/** `promptText` for a Word, Sentence or Fact read directly (a face has its Document, not the Material). */
export function itemPromptText(item: Item, slot: string): { question: string; answer: string } {
  switch (item.type) {
    case WORD: {
      const term = item.term || item.title;
      if (slot === LISTEN) return { question: LISTEN_QUESTION, answer: term };
      return slot === FORWARD ? { question: term, answer: item.meaning } : { question: item.meaning, answer: term };
    }
    case FACT:
      return { question: item.question || item.title, answer: item.answer };
    case SENTENCE: {
      const text = item.text ?? "";
      if (slot === LISTEN) return { question: LISTEN_QUESTION, answer: plainSentence(text) };
      let answer = "";
      const question = parseCloze(text)
        .map((p) => {
          if (p.kind === "text" || p.slot !== slot) return p.text;
          answer = p.text;
          return p.hint ? `____ (${p.hint})` : "____";
        })
        .join("");
      return { question, answer };
    }
  }
}
