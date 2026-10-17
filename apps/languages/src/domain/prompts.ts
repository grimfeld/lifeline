import { blankSlots, plainSentence } from "./cloze";
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

/** The slots of Knowledge's own types: a Word's forward and reverse, one per blank of a Sentence, a Fact's one forward. */
export function itemSlots(item: Item): string[] {
  if (item.type === FACT) return ["forward"];
  return item.type === WORD ? ["forward", "reverse"] : item.type === SENTENCE ? blankSlots(item.text ?? "") : [];
}

/** A Word or Sentence read as Material — the same reading its Recallable declaration gives. */
export function itemMaterial(item: Item): Material {
  return { id: item.id, type: item.type, title: item.title, topicId: item.languageId, addedAt: item.addedAt, live: !item.paused, slots: itemSlots(item), originId: item.originId ?? "" };
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
