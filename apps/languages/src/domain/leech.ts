import { promptsOf } from "./prompts";
import { recallsByPrompt } from "./practice";
import type { Material, Recall } from "./types";

/** Policy, in one place (CONTEXT.md "Leech"): this many fails among a Prompt's last LEECH_WINDOW Recalls make it a Leech. */
export const LEECH_FAILS = 4;
export const LEECH_WINDOW = 8;

export interface Leech {
  itemId: string;
  slot: string;
  /** Fails among its last LEECH_WINDOW Recalls. */
  fails: number;
}

/**
 * The Leeches among some material (CONTEXT.md "Leech"): derived on every
 * read, never stored, so a Prompt stops being one as its recent Recalls
 * pass. Paused material and drafts are not live, so never listed; struck-out
 * Recalls count for nothing. Most fails first.
 */
export function leeches(items: Material[], recalls: Recall[]): Leech[] {
  return leechesBy(items, recallsByPrompt(recalls.filter((r) => !r.deleted)));
}

/** The Leeches, from Recalls already grouped by Prompt (`recallsByPrompt`, struck-out ones left out): for a reader that groups them once for more than this. */
export function leechesBy(items: Material[], by: Map<string, Recall[]>): Leech[] {
  const out: Leech[] = [];
  for (const m of items) {
    if (!m.live) continue;
    for (const p of promptsOf(m)) {
      const recent = [...(by.get(p.key) ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, LEECH_WINDOW);
      const fails = recent.filter((r) => r.grade === "fail").length;
      if (fails >= LEECH_FAILS) out.push({ itemId: m.id, slot: p.slot, fails });
    }
  }
  return out.sort((a, b) => b.fails - a.fails || a.itemId.localeCompare(b.itemId) || a.slot.localeCompare(b.slot));
}
