import { addDays, todayStr } from "@lifeline/core";
import { parseCloze, plainSentence } from "./cloze";
import type { MaterialDoc } from "./material";
import { dayOf, heldPrompts, introducedByTopic, queueOfHeld, recallsByPrompt, recallsOfLive, retention } from "./practice";
import { LISTEN } from "./prompts";
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

/** A Prompt as the report lists it. */
export interface ReportedPrompt {
  itemId: string;
  /** The Document's type, so an agent can tell a Word from a Fact. */
  type: string;
  slot: string;
  question: string;
  /** Null where this App cannot phrase it: another App's Recallable material (read by its title). */
  answer: string | null;
  /** Fails among the last 30 days' Recalls. */
  fails: number;
  /** Latest first. */
  recalls: ReportedRecall[];
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
}

/** A Prompt's question and answer, as its face shows them (faces.tsx). */
export function promptText(m: MaterialDoc, slot: string): { question: string; answer: string | null } {
  if (m.type === WORD) {
    const w = m.doc as unknown as Word;
    const term = w.term || w.title;
    if (slot === LISTEN) return { question: "(listen)", answer: term };
    return slot === "forward" ? { question: term, answer: w.meaning } : { question: w.meaning, answer: term };
  }
  if (m.type === FACT) {
    const f = m.doc as unknown as Fact;
    return { question: f.question || f.title, answer: f.answer };
  }
  if (m.type === SENTENCE) {
    const s = m.doc as unknown as Sentence;
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
  };
}

function mostFailed(live: MaterialDoc[], recalls: Recall[], now: Date): ReportedPrompt[] {
  const from = addDays(todayStr(now), -(FAILED_DAYS - 1));
  const byId = new Map(live.map((m) => [m.id, m]));
  const out: (ReportedPrompt & { lastFail: string })[] = [];
  for (const list of recallsByPrompt(recalls).values()) {
    const newest = [...list].sort((a, b) => b.at.localeCompare(a.at));
    const fails = newest.filter((r) => r.grade === "fail" && dayOf(r.at) >= from);
    const m = byId.get(newest[0]!.itemId);
    if (!fails.length || !m) continue;
    const { question, answer } = promptText(m, newest[0]!.slot);
    out.push({ itemId: m.id, type: m.type, slot: newest[0]!.slot, question, answer, fails: fails.length, recalls: newest.slice(0, RECENT_RECALLS_SHOWN).map(reportedRecall), lastFail: fails[0]!.at });
  }
  return out
    .sort((a, b) => b.fails - a.fails || b.lastFail.localeCompare(a.lastFail) || a.itemId.localeCompare(b.itemId) || a.slot.localeCompare(b.slot))
    .slice(0, MOST_FAILED_SHOWN)
    .map(({ lastFail: _, ...p }) => p);
}
