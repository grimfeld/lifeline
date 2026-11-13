import { addDays, todayStr } from "@lifeline/core";
import type { MaterialDoc } from "./material";
import { leechesBy } from "./leech";
import { dayOf, heldPrompts, introducedByTopic, queueOfHeld, recallsByPrompt, recallsOfLive, retention } from "./practice";
import { promptText, promptsOf } from "./prompts";
import { sameName } from "./names";
import type { Deck, Grade, Recall, Topic } from "./types";

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
  // Grouped once: the most-failed list and the Leeches read the same Recalls by Prompt.
  const by = recallsByPrompt(mine.filter((r) => !r.deleted));
  return {
    retention: retention(mine, now),
    dueToday: q.due,
    newToday: q.newToday,
    newWaiting: q.newWaiting,
    mostFailed: mostFailed(live, by, now),
    leeches: reportedLeeches(live, by),
  };
}

/** The Prompts failed most lately, among those the material still yields (as Leeches read them): a rewritten blank or a removed clip leaves its old fails behind. */
function mostFailed(live: MaterialDoc[], by: Map<string, Recall[]>, now: Date): ReportedPrompt[] {
  const from = addDays(todayStr(now), -(FAILED_DAYS - 1));
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

function reportedLeeches(live: MaterialDoc[], by: Map<string, Recall[]>): ReportedLeech[] {
  const byId = new Map(live.map((m) => [m.id, m]));
  return leechesBy(live, by).map((l) => {
    const m = byId.get(l.itemId)!;
    return { itemId: l.itemId, type: m.type, slot: l.slot, ...promptText(m, l.slot), fails: l.fails };
  });
}

/**
 * The keyed, normalised reads a Topic's report takes (data/repo.ts gives the
 * real ones): each asks for one Topic, so the report never reads another's.
 */
export interface ReportReads {
  /** Every Topic, archived or not. */
  topics(): Promise<Topic[]>;
  decksOf(topicId: string): Promise<Deck[]>;
  /** The Topic's Recallable material, whichever App owns it (ADR 0073), and its Recalls, read together so Private material and its Recalls leave as one. */
  practiceOf(topicId: string): Promise<{ material: MaterialDoc[]; recalls: Recall[] }>;
}

/** What the `knowledge.report` Command answers: the Topic and Decks it was read for, then the report. */
export interface TopicReport extends PracticeReport {
  topic: string;
  /** Names of the Decks it was narrowed to; empty for the whole Topic. */
  decks: string[];
}

/**
 * The practice report for a Topic (its id or name), optionally narrowed to
 * some of its Decks (ids or names), read through the Knowledge App so Recalls
 * stay an internal type (ADR 0115). Read-only. An unknown Topic or Deck throws,
 * naming what exists.
 */
export async function topicReport(input: { topic: string; decks?: string[] }, reads: ReportReads, now = new Date()): Promise<TopicReport> {
  const topics = (await reads.topics()).filter((t) => !t.archived);
  const wanted = input.topic.trim();
  const topic = topics.find((t) => t.id === wanted) ?? topics.find((t) => sameName(t.name, wanted));
  if (!topic) throw new Error(`No Topic “${input.topic}”. Topics: ${topics.map((t) => t.name).join(", ") || "none"}`);

  const [topicDecks, { material, recalls }] = await Promise.all([reads.decksOf(topic.id), reads.practiceOf(topic.id)]);
  const decks = (input.decks ?? []).map((ref) => {
    const deck = topicDecks.find((d) => d.id === ref) ?? topicDecks.find((d) => sameName(d.name, ref));
    if (!deck) throw new Error(`No Deck “${ref}” in ${topic.name}. Decks: ${topicDecks.map((d) => d.name).join(", ") || "none"}`);
    return deck;
  });
  const members = new Set(decks.flatMap((d) => d.members));
  const items = decks.length ? material.filter((m) => members.has(m.id)) : material;
  return { topic: topic.name, decks: decks.map((d) => d.name), ...practiceReport({ items, recalls, now, newCap: topic.newCap }) };
}
