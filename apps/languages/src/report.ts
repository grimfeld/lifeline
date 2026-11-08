import { documentsOf, recallableDefs } from "@lifeline/core";
import { materialOf } from "./domain/material";
import { practiceReport, type PracticeReport } from "./domain/report";
import { DECK, DEFAULT_NEW_CAP, RECALL, TOPIC, type Deck, type Recall, type Topic } from "./domain/types";

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** What `knowledge_report` answers: the Topic and Decks it was read for, then the report. */
export interface KnowledgeReport extends PracticeReport {
  topic: string;
  /** Names of the Decks it was narrowed to; empty for the whole Topic. */
  decks: string[];
}

/**
 * The practice report for a Topic (an id or its name), optionally narrowed to
 * some of its Decks (ids or names), read through the Knowledge App so Recalls
 * stay an internal type (ADR 0115). Read-only. An unknown Topic or Deck throws,
 * naming what exists.
 */
export async function knowledgeReport(input: { topic: string; decks?: string[] }, now = new Date()): Promise<KnowledgeReport> {
  const topics = (await documentsOf<Topic>(TOPIC)).filter((t) => !t.archived);
  const wanted = input.topic.trim();
  const topic = topics.find((t) => t.id === wanted) ?? topics.find((t) => same(t.name || t.title, wanted));
  if (!topic) throw new Error(`No Topic “${input.topic}”. Topics: ${topics.map((t) => t.name || t.title).join(", ") || "none"}`);

  const topicDecks = (await documentsOf<Deck>(DECK)).filter((d) => d.languageId === topic.id);
  const decks = (input.decks ?? []).map((ref) => {
    const deck = topicDecks.find((d) => d.id === ref) ?? topicDecks.find((d) => same(d.name || d.title, ref));
    if (!deck) throw new Error(`No Deck “${ref}” in ${topic.name || topic.title}. Decks: ${topicDecks.map((d) => d.name || d.title).join(", ") || "none"}`);
    return deck;
  });
  const members = new Set(decks.flatMap((d) => (Array.isArray(d.members) ? d.members : [])));

  const material = (await Promise.all(recallableDefs().map(async (def) => (await documentsOf(def.typeId)).map((doc) => materialOf(def, doc)))))
    .flat()
    .filter((m) => m.topicId === topic.id && (!decks.length || members.has(m.id)));
  const recalls = (await documentsOf<Recall>(RECALL)).filter((r) => r.languageId === topic.id);
  const cap = Number(topic.newCap);
  const newCap = Number.isFinite(cap) && cap >= 0 ? Math.round(cap) : DEFAULT_NEW_CAP;

  return { topic: topic.name || topic.title, decks: decks.map((d) => d.name || d.title), ...practiceReport({ items: material, recalls, now, newCap }) };
}
