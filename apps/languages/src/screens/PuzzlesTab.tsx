import type { ComponentType } from "react";
import { useSearchParams } from "react-router";
import { Button, EmptyState, Tip } from "@lifeline/ui";
import { Grid3x3, Play, RotateCw } from "lucide-react";
import type { PuzzleFormat } from "../domain/types";
import { setActiveTopic } from "../data/repo";
import { FORMAT_LABEL, playLabel, puzzleLine, useTodaysPuzzles } from "../data/puzzles";
import { WordlePlayer } from "../components/WordlePlayer";
import { ConnectionsPlayer } from "../components/ConnectionsPlayer";
import { CrosswordPlayer } from "../components/CrosswordPlayer";
import { usePuzzleOpener, type PlayerProps } from "../components/PuzzleShell";
import { practisePuzzle } from "./PracticeTab";

/** The Puzzle being played, by id: a link back to it survives a reload. */
const PUZZLE_PARAM = "puzzle";

const PLAYERS: Record<PuzzleFormat, ComponentType<PlayerProps>> = { wordle: WordlePlayer, crossword: CrosswordPlayer, connections: ConnectionsPlayer };

/**
 * Today's Puzzles (CONTEXT.md "Puzzle", ADR 0106): one row per active Topic
 * and format that can build one, with how it stands today — and the player.
 * No score, no streak; playing never touches the schedule.
 */
export function PuzzlesTab() {
  const [params, setParams] = useSearchParams();
  const { rows, puzzles, topics } = useTodaysPuzzles();
  const { open, busy } = usePuzzleOpener((p) => setParams({ tab: "puzzles", [PUZZLE_PARAM]: p.id }));

  const playingId = params.get(PUZZLE_PARAM);
  const playing = playingId ? puzzles.find((p) => p.id === playingId) : undefined;

  if (playing) {
    const topic = topics.find((t) => t.id === playing.languageId);
    const Player = PLAYERS[playing.format] ?? WordlePlayer;
    return (
      <Player
        puzzle={playing}
        topicName={topic?.name ?? "A topic"}
        onBack={() => setParams({ tab: "puzzles" })}
        onPractise={() => {
          setActiveTopic(playing.languageId);
          setParams(practisePuzzle(playing.id));
        }}
      />
    );
  }

  if (!rows.length) {
    return <EmptyState>No puzzles today. A Wordle-like uses words you have already practised the other way round (meaning to word), with a one-word term of 4 to 10 letters. A crossword needs five one-word answers that cross. Connections needs 4 decks with at least 4 practised words or facts each.</EmptyState>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">One a day per topic, from what you have already practised. Playing never changes when anything comes back.</p>
      {rows.map((row) => {
        const label = playLabel(row);
        return (
          <div key={`${row.topic.id}|${row.format}`} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
            <Grid3x3 className="text-muted-foreground size-4 shrink-0" />
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{row.topic.name}</span>
              <span className="text-muted-foreground truncate text-xs">{row.puzzle ? puzzleLine(row.puzzle) : `${FORMAT_LABEL[row.format]} · not started`}</span>
            </span>
            <Button size="sm" variant={label === "See" ? "outline" : "default"} className="shrink-0" onClick={() => void open(row)} disabled={busy(row)}>
              {label === "Play" && <Play />}
              {label}
            </Button>
            <Tip label={`Replay ${FORMAT_LABEL[row.format]} on ${row.topic.name}: a new puzzle, not counted`}>
              <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => void open(row, "replay")} disabled={busy(row)}>
                <RotateCw />
              </Button>
            </Tip>
          </div>
        );
      })}
    </div>
  );
}
