import { blankSlots } from "./cloze";
import { SENTENCE, WORD, type Item } from "./types";

/**
 * A Prompt (CONTEXT.md "Prompt"): one question derived from a Word or a
 * Sentence. Never stored — identified by its item and slot, which is what a
 * Recall points at.
 */
export interface Prompt {
  /** `${itemId}|${slot}` */
  key: string;
  itemId: string;
  slot: string;
  languageId: string;
  /** Ordering for "oldest added first": the item's addedAt, then its slot order. */
  addedAt: string;
  order: number;
}

export function promptKey(itemId: string, slot: string): string {
  return `${itemId}|${slot}`;
}

/** Every Prompt an item yields: a Word's forward and reverse, one per blank of a Sentence. */
export function promptsOf(item: Item): Prompt[] {
  const slots = item.type === WORD ? ["forward", "reverse"] : item.type === SENTENCE ? blankSlots(item.text) : [];
  return slots.map((slot, order) => ({ key: promptKey(item.id, slot), itemId: item.id, slot, languageId: item.languageId, addedAt: item.addedAt, order }));
}
