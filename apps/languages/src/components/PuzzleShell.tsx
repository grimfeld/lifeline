import { useState, type ReactNode } from "react";
import { Button, Card, CardContent, cn, toast } from "@lifeline/ui";
import { Play } from "lucide-react";
import type { Puzzle, PuzzleKind } from "../domain/types";
import { FORMAT_LABEL, giveUpPuzzle, openDailyPuzzle, openReplayPuzzle, type Played, type TodaysPuzzle } from "../data/puzzles";

/**
 * What every Puzzle player shares (ADR 0106): the header row, the end card
 * and giving up. Each format brings only its own board.
 */

/** What a player is handed: the Puzzle, its Topic's name, and where Back and "Practise now" go. */
export interface PlayerProps {
  puzzle: Puzzle;
  topicName: string;
  onBack: () => void;
  onPractise: () => void;
}

/** A finished daily's Tally that failed to fire: the outcome stands, the Habit missed it. */
export function tallied(p: Played): void {
  if (p.tallyError) toast.error(p.tallyError);
}

/** Give up: the Puzzle ends unsolved, its answers shown. */
export async function giveUp(puzzle: Puzzle): Promise<void> {
  try {
    tallied(await giveUpPuzzle(puzzle.id));
  } catch (err) {
    toast.error(`Couldn't give up: ${(err as Error).message}`);
  }
}

/** A player's frame: "Topic · format" and Back, over the board. */
export function PuzzleShell({ puzzle, topicName, onBack, children }: Pick<PlayerProps, "puzzle" | "topicName" | "onBack"> & { children: ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-4">
      <div className="text-muted-foreground flex items-center justify-between gap-2 text-sm">
        <span className="min-w-0 flex-1 truncate">
          {topicName} · {FORMAT_LABEL[puzzle.format]}
        </span>
        <Button size="sm" variant="ghost" className="shrink-0" onClick={onBack}>
          Back
        </Button>
      </div>
      {children}
    </div>
  );
}

/** The end: how it went, the material in full, and a way to practise it. */
export function PuzzleEnd({ puzzle, status, onPractise, onBack, children }: Pick<PlayerProps, "puzzle" | "onPractise" | "onBack"> & { status: string; children: ReactNode }) {
  return (
    <Card className="py-0">
      <CardContent className="grid gap-3 px-4 py-4">
        <span className={cn("text-sm font-medium", puzzle.outcome === "solved" ? "text-success" : "text-muted-foreground")}>{status}</span>
        {children}
        <p className="text-muted-foreground text-xs">Playing never changes when anything comes back: only a practice does.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button className="flex-1" onClick={onPractise}>
            <Play /> Practise now
          </Button>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const rowKey = (row: TodaysPuzzle) => `${row.topic.id}|${row.format}`;

/**
 * Opening a row of today's Puzzles: its daily — the one already opened, else
 * drawn now — or a replay. `onOpened` takes the Puzzle there; a Topic with
 * nothing to draw, or a failure, says so in a toast.
 */
export function usePuzzleOpener(onOpened: (p: Puzzle) => void): { open: (row: TodaysPuzzle, kind?: PuzzleKind) => Promise<void>; busy: (row: TodaysPuzzle) => boolean } {
  const [opening, setOpening] = useState("");
  async function open(row: TodaysPuzzle, kind: PuzzleKind = "daily") {
    if (kind === "daily" && row.puzzle) return onOpened(row.puzzle);
    setOpening(rowKey(row));
    try {
      const p = await (kind === "daily" ? openDailyPuzzle : openReplayPuzzle)(row.topic.id, row.format);
      if (p) onOpened(p);
      else toast.error(`${row.topic.name} has nothing to build a puzzle from${kind === "daily" ? " today" : ""}.`);
    } catch (e) {
      toast.error(`Couldn't open the ${kind === "daily" ? "puzzle" : "replay"}: ${(e as Error).message}`);
    } finally {
      setOpening("");
    }
  }
  return { open, busy: (row) => opening === rowKey(row) };
}
