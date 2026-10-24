import { useNavigate } from "react-router";
import { Button, CardUnavailable } from "@lifeline/ui";
import type { CardProps } from "@lifeline/core";
import { Grid3x3 } from "lucide-react";
import { KNOWLEDGE_HREF } from "../domain/types";
import { FORMAT_LABEL, playLabel, useTodaysPuzzles, type TodaysPuzzle } from "../data/puzzles";
import { usePuzzleOpener } from "../components/PuzzleShell";

/** How today's Puzzle stands, in two words. */
function standing(row: TodaysPuzzle): string {
  if (!row.puzzle) return "not started";
  if (row.puzzle.outcome === "playing") return "in progress";
  return row.puzzle.outcome;
}

/**
 * "Today's Puzzles" (a Card, ADR 0106): each active Topic's daily Puzzles and
 * how each stands — not started, in progress, solved or unsolved — one tap
 * into the Puzzle itself, drawn then if it was not opened yet.
 */
export function PuzzlesCard(_: CardProps) {
  const navigate = useNavigate();
  const { rows, topics } = useTodaysPuzzles();
  const { open, busy } = usePuzzleOpener((p) => navigate(`${KNOWLEDGE_HREF}?tab=puzzles&puzzle=${p.id}`));

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
            <Button size="xs" variant="outline" className="shrink-0" onClick={() => void open(r)} disabled={busy(r)}>
              {playLabel(r)}
            </Button>
          </li>
        ))}
        {rows.length > 5 && <li className="text-muted-foreground">+{rows.length - 5} more</li>}
      </ul>
    </div>
  );
}
