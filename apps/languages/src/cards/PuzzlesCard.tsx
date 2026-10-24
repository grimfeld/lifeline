import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, CardUnavailable } from "@lifeline/ui";
import type { CardProps } from "@lifeline/core";
import { Grid3x3 } from "lucide-react";
import { KNOWLEDGE_HREF } from "../domain/types";
import { useDecks, useFacts, useRecalls, useSentences, useTopics, useWords } from "../data/repo";
import { FORMAT_LABEL, todayOf, usePuzzles, type TodaysPuzzle } from "../data/puzzles";

/** How today's Puzzle stands, in two words. */
export function standing(row: TodaysPuzzle): string {
  if (!row.puzzle) return "not started";
  if (row.puzzle.outcome === "playing") return "in progress";
  return row.puzzle.outcome;
}

/** Where a row opens: its Puzzle if started, else the Puzzles tab, where Play draws it. */
export function puzzleHref(row: TodaysPuzzle): string {
  return row.puzzle ? `${KNOWLEDGE_HREF}?tab=puzzles&puzzle=${row.puzzle.id}` : `${KNOWLEDGE_HREF}?tab=puzzles`;
}

/**
 * "Today's Puzzles" (a Card, ADR 0106): each active Topic's daily Puzzles and
 * how each stands — not started, in progress, solved or unsolved — one tap in.
 */
export function PuzzlesCard(_: CardProps) {
  const topics = useTopics();
  const words = useWords();
  const recalls = useRecalls();
  const facts = useFacts();
  const decks = useDecks();
  // A daily ends at midnight: re-read the clock every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const sentences = useSentences();
  const puzzles = usePuzzles(now);
  const rows = useMemo(() => todayOf(topics, words, recalls, puzzles, now, { facts, decks, sentences }), [topics, words, recalls, puzzles, now, facts, decks, sentences]);

  if (!topics.some((t) => !t.archived)) return <CardUnavailable message="No topic yet" />;
  if (!rows.length) return <CardUnavailable message="No puzzle today" />;
  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <ul className="grid min-w-0 gap-1 text-xs">
        {rows.slice(0, 5).map((r) => (
          <li key={`${r.topic.id}|${r.format}`} className="flex min-w-0 items-center gap-2">
            <Grid3x3 className="text-muted-foreground size-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">
              {r.topic.name} · {FORMAT_LABEL[r.format]}
            </span>
            <span className="text-muted-foreground shrink-0">{standing(r)}</span>
            <Button size="xs" variant="outline" className="shrink-0" asChild>
              <Link to={puzzleHref(r)}>{r.puzzle ? (r.puzzle.outcome === "playing" ? "Resume" : "See") : "Play"}</Link>
            </Button>
          </li>
        ))}
        {rows.length > 5 && <li className="text-muted-foreground">+{rows.length - 5} more</li>}
      </ul>
    </div>
  );
}
