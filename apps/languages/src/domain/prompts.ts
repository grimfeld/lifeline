import { blankSlots } from "./cloze";
import { SENTENCE, WORD, type Item, type Material } from "./types";

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

/** The slots of Knowledge's own types: a Word's forward and reverse, one per blank of a Sentence. */
export function itemSlots(item: Item): string[] {
  return item.type === WORD ? ["forward", "reverse"] : item.type === SENTENCE ? blankSlots(item.text ?? "") : [];
}

/** A Word or Sentence read as Material — the same reading its Recallable declaration gives. */
export function itemMaterial(item: Item): Material {
  return { id: item.id, type: item.type, title: item.title, topicId: item.languageId, addedAt: item.addedAt, live: !item.paused, slots: itemSlots(item) };
}

/** Every Prompt a piece of Material yields. */
export function promptsOf(m: Material): Prompt[] {
  return m.slots.map((slot, order) => ({ key: promptKey(m.id, slot), itemId: m.id, slot, topicId: m.topicId, addedAt: m.addedAt, order }));
}
