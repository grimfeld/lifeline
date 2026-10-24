import { addDays, todayStr, type DateStr } from "@lifeline/core";
import { promptKey, promptsOf, type Prompt } from "./prompts";
import { replay, type Held } from "./schedule";
import type { Material, Recall } from "./types";

/** Local day of an ISO instant. */
export function dayOf(iso: string): DateStr {
  return todayStr(new Date(iso));
}

/** Recalls grouped by the Prompt they answer. */
export function recallsByPrompt(recalls: Recall[]): Map<string, Recall[]> {
  const m = new Map<string, Recall[]>();
  for (const r of recalls) {
    const k = promptKey(r.itemId, r.slot);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

export interface HeldPrompt extends Prompt {
  held: Held;
}

/** Every Prompt of the given Material with how it is held, read from the Recalls. */
export function heldPrompts(items: Material[], recalls: Recall[]): HeldPrompt[] {
  const by = recallsByPrompt(recalls);
  return items.flatMap(promptsOf).map((p) => ({ ...p, held: replay(by.get(p.key) ?? []) }));
}

/**
 * How many Prompts met their first Recall today, across the whole Topic —
 * what the daily new cap counts against, whichever Deck the Practice is
 * narrowed to (CONTEXT.md "Practice").
 */
export function introducedOn(recalls: Recall[], day: DateStr): number {
  let n = 0;
  for (const list of recallsByPrompt(recalls).values()) {
    const first = list.reduce((a, b) => (b.at < a.at ? b : a));
    if (dayOf(first.at) === day) n++;
  }
  return n;
}

/** Today's introductions per Topic — each Topic's daily new cap counts against its own (CONTEXT.md "Topic"). */
export function introducedByTopic(recalls: Recall[], day: DateStr): Map<string, number> {
  const out = new Map<string, number>();
  for (const list of recallsByPrompt(recalls).values()) {
    const first = list.reduce((a, b) => (b.at < a.at ? b : a));
    if (dayOf(first.at) === day) out.set(first.languageId, (out.get(first.languageId) ?? 0) + 1);
  }
  return out;
}

/** A daily new cap: one number for a Practice of one Topic, or each Topic's own for a Practice across several. */
export type NewCap = number | ((topicId: string) => number);

/**
 * Reorder so two Prompts of the same item never come back to back, where
 * any other order allows it — greedy, keeping the given order otherwise.
 */
export function spaceSiblings<T extends { itemId: string }>(queue: T[]): T[] {
  const rest = [...queue];
  const out: T[] = [];
  while (rest.length) {
    const last = out[out.length - 1]?.itemId;
    const i = rest.findIndex((p) => p.itemId !== last);
    out.push(...rest.splice(i === -1 ? 0 : i, 1));
  }
  return out;
}

/** A failed Prompt comes back in minutes; within this window it is offered rather than leaving the Practice idle. */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

export interface PracticeQueue {
  /** What to recall next, in order: due first, then new up to the cap. */
  queue: HeldPrompt[];
  /** Due now (not counting new). */
  due: number;
  /** New Prompts this Practice may still introduce today. */
  newToday: number;
  /** New Prompts waiting in all, beyond today's cap too. */
  newWaiting: number;
  /** The soonest a Prompt falls due after now, when nothing is due. */
  nextAt: Date | null;
}

/**
 * One Practice's queue (CONTEXT.md "Practice"): due Prompts first, oldest
 * due first, then new ones up to what each Topic's daily new cap still allows
 * today, oldest added first — siblings spaced apart. `items` are the live
 * Material it draws from (a Topic, a Deck, a Source's, or everything);
 * `recalls` must hold every Recall of each Topic it touches, since the cap
 * counts across the whole Topic however the Practice is narrowed.
 */
export function practiceQueue(items: Material[], recalls: Recall[], opts: { now: Date; newCap: NewCap }): PracticeQueue {
  return queueOfHeld(heldPrompts(items, recalls), introducedByTopic(recalls, todayStr(opts.now)), opts);
}

/**
 * `practiceQueue` over Prompts already held, given today's introductions per
 * Topic — so a screen replays the Recalls once and narrows the held Prompts
 * per Deck or Source, rather than replaying them for each.
 */
export function queueOfHeld(all: HeldPrompt[], introduced: Map<string, number>, opts: { now: Date; newCap: NewCap }): PracticeQueue {
  const now = opts.now.getTime();
  const dueNow = all.filter((p) => p.held.due && p.held.due.getTime() <= now).sort((a, b) => a.held.due!.getTime() - b.held.due!.getTime());
  const fresh = all.filter((p) => p.held.state === "new").sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.itemId.localeCompare(b.itemId) || a.order - b.order);
  const cap = opts.newCap;
  const capOf = typeof cap === "number" ? () => cap : cap;
  const left = new Map<string, number>();
  const newOnes = fresh.filter((p) => {
    const room = left.get(p.topicId) ?? Math.max(0, capOf(p.topicId) - (introduced.get(p.topicId) ?? 0));
    left.set(p.topicId, Math.max(0, room - 1));
    return room > 0;
  });
  let queue = [...dueNow, ...newOnes];
  if (!queue.length) {
    queue = all.filter((p) => p.held.due && p.held.due.getTime() <= now + LEARN_AHEAD_MS).sort((a, b) => a.held.due!.getTime() - b.held.due!.getTime());
  }
  const later = all.filter((p) => p.held.due && p.held.due.getTime() > now).map((p) => p.held.due!.getTime());
  return {
    queue: spaceSiblings(queue),
    due: dueNow.length,
    newToday: newOnes.length,
    newWaiting: fresh.length,
    nextAt: later.length ? new Date(Math.min(...later)) : null,
  };
}

/**
 * Retention (CONTEXT.md "Retention"): the share of the last 30 days' Recalls
 * passed, leaving out each Prompt's very first — meeting it is not
 * remembering it. Null when there is nothing to read.
 */
export function retention(recalls: Recall[], now: Date, days = 30): { passed: number; total: number; share: number } | null {
  const from = addDays(todayStr(now), -(days - 1));
  let passed = 0;
  let total = 0;
  for (const list of recallsByPrompt(recalls).values()) {
    const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
    for (const r of sorted.slice(1)) {
      if (dayOf(r.at) < from) continue;
      total++;
      if (r.grade === "pass") passed++;
    }
  }
  return total ? { passed, total, share: passed / total } : null;
}

/** Due counts for the week ahead: today (overdue included) and the six days after. New Prompts are not counted. */
export function dueAhead(items: Material[], recalls: Recall[], now: Date, days = 7): { day: DateStr; count: number }[] {
  return dueAheadOfHeld(heldPrompts(items, recalls), now, days);
}

/** `dueAhead` over Prompts already held. */
export function dueAheadOfHeld(held: HeldPrompt[], now: Date, days = 7): { day: DateStr; count: number }[] {
  const today = todayStr(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: addDays(today, i), count: 0 }));
  for (const p of held) {
    if (!p.held.due) continue;
    const d = todayStr(p.held.due);
    const slot = d <= today ? out[0] : out.find((x) => x.day === d);
    if (slot) slot.count++;
  }
  return out;
}
