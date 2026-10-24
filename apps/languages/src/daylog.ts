import { useMemo } from "react";
import type { DaylogItem, DaylogProvider } from "@lifeline/core";
import { dayOf } from "./domain/practice";
import { APP_ID, FACT, KNOWLEDGE_HREF, SENTENCE } from "./domain/types";
import { useFacts, useTopics, useRecalls, useSentences, useWords } from "./data/repo";
import { puzzleLine, usePuzzles } from "./data/puzzles";

/** "09:05" of an ISO instant, local. */
function clockOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * The Daylog Contract for Knowledge: per Topic, the day's practice —
 * "Practised · Spanish · 42 recalls · 36 passed", at its first Recall — and
 * what was added that day, and one line per daily Puzzle finished that day.
 * Read from the Recalls and the Puzzles; nothing else is kept.
 */
export const knowledgeDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const topics = useTopics();
    const recalls = useRecalls();
    const words = useWords();
    const sentences = useSentences();
    const facts = useFacts();
    const now = useMemo(() => new Date(), []);
    const puzzles = usePuzzles(now);
    const out: DaylogItem[] = [];
    for (const l of topics) {
      const today = recalls.filter((r) => r.languageId === l.id && r.at && dayOf(r.at) === date).sort((a, b) => a.at.localeCompare(b.at));
      const first = today[0];
      if (first) {
        const passed = today.filter((r) => r.grade === "pass").length;
        out.push({ key: `${APP_ID}/practice/${l.id}`, appId: APP_ID, itemId: l.id, kind: "Practised", title: l.name, subtitle: `${today.length} recall${today.length === 1 ? "" : "s"} · ${passed} passed`, time: clockOf(first.at), href: KNOWLEDGE_HREF, tags: l.tags });
      }
      const added = [...words, ...sentences, ...facts].filter((i) => i.languageId === l.id && i.addedAt && dayOf(i.addedAt) === date);
      if (added.length) {
        const nS = added.filter((i) => i.type === SENTENCE).length;
        const nF = added.filter((i) => i.type === FACT).length;
        const nW = added.length - nS - nF;
        const what = [nW && `${nW} word${nW === 1 ? "" : "s"}`, nS && `${nS} sentence${nS === 1 ? "" : "s"}`, nF && `${nF} fact${nF === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
        out.push({ key: `${APP_ID}/added/${l.id}`, appId: APP_ID, itemId: l.id, kind: "Added", title: l.name, subtitle: what, href: `${KNOWLEDGE_HREF}?tab=words`, tags: l.tags });
      }
      for (const p of puzzles) {
        if (p.languageId !== l.id || p.kind !== "daily" || !p.finishedAt || dayOf(p.finishedAt) !== date) continue;
        out.push({ key: `${APP_ID}/puzzle/${p.id}`, appId: APP_ID, itemId: p.id, kind: "Puzzle", title: l.name, subtitle: puzzleLine(p), time: clockOf(p.finishedAt), href: `${KNOWLEDGE_HREF}?tab=puzzles`, tags: l.tags });
      }
    }
    return out;
  },
};
