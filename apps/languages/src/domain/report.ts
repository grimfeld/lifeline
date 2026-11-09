import { addDays, todayStr } from "@lifeline/core";
import { parseCloze, plainSentence } from "./cloze";
import type { MaterialDoc } from "./material";
import { leeches as readLeeches } from "./leech";
import { dayOf, heldPrompts, introducedByTopic, queueOfHeld, recallsByPrompt, recallsOfLive, retention } from "./practice";
import { LISTEN, promptsOf } from "./prompts";
import { FACT, SENTENCE, WORD, type Fact, type Grade, type Recall, type Sentence, type Word } from "./types";

/** Policy, in one place: how many failed Prompts the report lists, and how many Recalls it shows with each. */
export const MOST_FAILED_SHOWN = 10;
export const RECENT_RECALLS_SHOWN = 5;
/** The window the most-failed list reads, in days (as Retention's). */
export const FAILED_DAYS = 30;

/** One Recall as the report shows it. */
export interface ReportedRecall {
  grade: Grade;
  at: string;
  /** What was typed before revealing (ADR 0116); absent where nothing was. */
  typed?: string;
}

function reportedRecall(r: Recall): ReportedRecall {
  return r.typed ? { grade: r.grade, at: r.at, typed: r.typed } : { grade: r.grade, at: r.at };
}

/** One Prompt as the report names it, whichever list it is in. */
interface PromptLine {
  itemId: string;
  /** The Document's type, so an agent can tell a Word from a Fact. */
  type: string;
  slot: string;
  question: string;
  /** Null where this App cannot phrase it: another App's Recallable material (read by its title). */
  answer: string | null;
}

/** A Prompt among the most failed. */
export interface ReportedPrompt extends PromptLine {
  /** Fails among the last 30 days' Recalls. */
  fails: number;
  /** Latest first. */
  recalls: ReportedRecall[];
}

/** A Leech as the report lists it (CONTEXT.md "Leech"). */
export interface ReportedLeech extends PromptLine {
  /** Fails among its last 8 Recalls. */
  fails: number;
}

export interface PracticeReport {
  /** The app's own Retention figure over the kept material, null when there is nothing to read. */
  retention: { passed: number; total: number; share: number } | null;
  /** Due now (overdue included), not counting new. */
  dueToday: number;
  /** New Prompts this Practice may still introduce today, by the Topic's daily new cap. */
  newToday: number;
  /** New Prompts waiting in all. */
  newWaiting: number;
  /** Most failed first. */
  mostFailed: ReportedPrompt[];
  /** Prompts with 4 or more fails among their last 8 Recalls, most fails first. */
  leeches: ReportedLeech[];
}

/** Material whose doc is known by its type: the kinds the Knowledge App owns. Any other Recallable (a Quote) stays a plain MaterialDoc. */
export type TypedMaterial = MaterialDoc & ({ type: typeof WORD; doc: Word } | { type: typeof FACT; doc: Fact } | { type: typeof SENTENCE; doc: Sentence });

const isTyped = (m: MaterialDoc): m is TypedMaterial => m.type === WORD || m.type === FACT || m.type === SENTENCE;

/** A Prompt's question and answer, as its face shows them (faces.tsx). */
export function promptText(m: MaterialDoc, slot: string): { question: string; answer: string | null } {
  if (!isTyped(m)) return { question: m.title, answer: null };
  if (m.type === WORD) {
    const w = m.doc;
    const term = w.term || w.title;
    if (slot === LISTEN) return { question: "(listen)", answer: term };
    return slot === "forward" ? { question: term, answer: w.meaning } : { question: w.meaning, answer: term };
  }
  if (m.type === FACT) {
    const f = m.doc;
    return { question: f.question || f.title, answer: f.answer };
  }
  if (m.type === SENTENCE) {
    const s = m.doc;
    if (slot === LISTEN) return { question: "(listen)", answer: plainSentence(s.text ?? "") };
    let answer = "";
    const question = parseCloze(s.text ?? "")
      .map((p) => {
        if (p.kind === "text" || p.slot !== slot) return p.text;
        answer = p.text;
        return p.hint ? `____ (${p.hint})` : "____";
      })
      .join("");
    return { question, answer };
  }
  return { question: m.title, answer: null };
}

export interface ReportInput {
  /** The material to report on, a Topic's or narrowed to some of its Decks: live or not. */
  items: MaterialDoc[];
  /** Every Recall of the Topic: the daily new cap counts across it however the report is narrowed. */
  recalls: Recall[];
  now: Date;
  newCap: number;
}

/**
 * The practice report (CONTEXT.md "Retention", ADR 0115): how practice is
 * going, read from the Recalls like every figure in the app. Paused material
 * and drafts are left out of all of it. Each part is its own function so the
 * report can grow by one field at a time.
 */
export function practiceReport({ items, recalls, now, newCap }: ReportInput): PracticeReport {
  const live = items.filter((m) => m.live);
  const mine = recallsOfLive(live, recalls);
  const held = heldPrompts(live, mine);
  const q = queueOfHeld(held, introducedByTopic(recalls, todayStr(now)), { now, newCap });
  return {
    retention: retention(mine, now),
    dueToday: q.due,
    newToday: q.newToday,
    newWaiting: q.newWaiting,
    mostFailed: mostFailed(live, mine, now),
    leeches: reportedLeeches(live, mine),
  };
}

/** The Prompts failed most lately, among those the material still yields (as Leeches read them): a rewritten blank or a removed clip leaves its old fails behind. */
function mostFailed(live: MaterialDoc[], recalls: Recall[], now: Date): ReportedPrompt[] {
  const from = addDays(todayStr(now), -(FAILED_DAYS - 1));
  const by = recallsByPrompt(recalls);
  const out: (ReportedPrompt & { lastFail: string })[] = [];
  for (const m of live) {
    for (const p of promptsOf(m)) {
      const newest = [...(by.get(p.key) ?? [])].sort((a, b) => b.at.localeCompare(a.at));
      const fails = newest.filter((r) => r.grade === "fail" && dayOf(r.at) >= from);
      if (!fails.length) continue;
      out.push({ itemId: m.id, type: m.type, slot: p.slot, ...promptText(m, p.slot), fails: fails.length, recalls: newest.slice(0, RECENT_RECALLS_SHOWN).map(reportedRecall), lastFail: fails[0]!.at });
    }
  }
  return out
    .sort((a, b) => b.fails - a.fails || b.lastFail.localeCompare(a.lastFail) || a.itemId.localeCompare(b.itemId) || a.slot.localeCompare(b.slot))
    .slice(0, MOST_FAILED_SHOWN)
    .map(({ lastFail: _, ...p }) => p);
}

function reportedLeeches(live: MaterialDoc[], recalls: Recall[]): ReportedLeech[] {
  const byId = new Map(live.map((m) => [m.id, m]));
  return readLeeches(live, recalls).map((l) => {
    const m = byId.get(l.itemId)!;
    return { itemId: l.itemId, type: m.type, slot: l.slot, ...promptText(m, l.slot), fails: l.fails };
  });
}
