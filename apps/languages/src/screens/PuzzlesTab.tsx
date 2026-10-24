import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, EmptyState, toast } from "@lifeline/ui";
import { Grid3x3, Play, RotateCw } from "lucide-react";
import { setActiveTopic, useFacts, useRecalls, useSentences, useTopics, useWords } from "../data/repo";
import { FORMAT_LABEL, openDailyPuzzle, openReplayPuzzle, puzzleLine, todayOf, usePuzzles, type TodaysPuzzle } from "../data/puzzles";
import { WordlePlayer } from "../components/WordlePlayer";
import { CrosswordPlayer } from "../components/CrosswordPlayer";

/** The Puzzle being played, by id: a link back to it survives a reload. */
const PUZZLE_PARAM = "puzzle";

/**
 * Today's Puzzles (CONTEXT.md "Puzzle", ADR 0106): one row per active Topic
 * and format that can build one, with how it stands today — and the player.
 * No score, no streak; playing never touches the schedule.
 */
export function PuzzlesTab() {
  const [params, setParams] = useSearchParams();
  // Re-read once a minute, so a daily left open past midnight ends there.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const topics = useTopics();
  const words = useWords();
  const recalls = useRecalls();
  const sentences = useSentences();
  const facts = useFacts();
  const puzzles = usePuzzles(now);
  const today = useMemo(() => todayOf(topics, words, recalls, puzzles, now, { sentences, facts }), [topics, words, recalls, puzzles, now, sentences, facts]);
  const [opening, setOpening] = useState("");

  const playingId = params.get(PUZZLE_PARAM);
  const playing = playingId ? puzzles.find((p) => p.id === playingId) : undefined;

  async function open(row: TodaysPuzzle) {
    if (row.puzzle) return setParams({ tab: "puzzles", [PUZZLE_PARAM]: row.puzzle.id });
    setOpening(row.topic.id);
    try {
      const p = await openDailyPuzzle(row.topic.id, row.format);
      if (p) setParams({ tab: "puzzles", [PUZZLE_PARAM]: p.id });
      else toast.error(`${row.topic.name} has nothing to build a puzzle from today.`);
    } catch (e) {
      toast.error(`Couldn't open the puzzle: ${(e as Error).message}`);
    } finally {
      setOpening("");
    }
  }

  async function replay(row: TodaysPuzzle) {
    setOpening(row.topic.id);
    try {
      const p = await openReplayPuzzle(row.topic.id, row.format);
      if (p) setParams({ tab: "puzzles", [PUZZLE_PARAM]: p.id });
      else toast.error(`${row.topic.name} has nothing to build a puzzle from.`);
    } catch (e) {
      toast.error(`Couldn't open the replay: ${(e as Error).message}`);
    } finally {
      setOpening("");
    }
  }

  if (playing) {
    const topic = topics.find((t) => t.id === playing.languageId);
    const Player = playing.format === "crossword" ? CrosswordPlayer : WordlePlayer;
    return (
      <Player
        puzzle={playing}
        topicName={topic?.name ?? "A topic"}
        onBack={() => setParams({ tab: "puzzles" })}
        onPractise={() => {
          setActiveTopic(playing.languageId);
          setParams({ practice: "topic" });
        }}
      />
    );
  }

  if (!today.length) {
    return <EmptyState>No puzzles today. A puzzle uses only what you have already practised: a Wordle-like needs a word met the other way round (meaning to word) with a one-word term of 4 to 10 letters, a crossword five one-word answers that cross.</EmptyState>;
  }

  return (
    <div className="grid gap-2">
      <p className="text-muted-foreground text-sm">One a day per topic, from what you have already practised. Playing never changes when anything comes back.</p>
      {today.map((row) => (
        <div key={`${row.topic.id}|${row.format}`} className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm">
          <Grid3x3 className="text-muted-foreground size-4 shrink-0" />
          <span className="grid min-w-0 flex-1">
            <span className="truncate font-medium">{row.topic.name}</span>
            <span className="text-muted-foreground truncate text-xs">{row.puzzle ? puzzleLine(row.puzzle) : `${FORMAT_LABEL[row.format]} · not started`}</span>
          </span>
          <Button size="sm" variant={row.puzzle && row.puzzle.outcome !== "playing" ? "outline" : "default"} className="shrink-0" onClick={() => void open(row)} disabled={opening === row.topic.id}>
            {!row.puzzle ? (
              <>
                <Play /> Play
              </>
            ) : row.puzzle.outcome === "playing" ? (
              "Resume"
            ) : (
              "See"
            )}
          </Button>
          <Button size="sm" variant="ghost" className="shrink-0" aria-label={`Replay ${FORMAT_LABEL[row.format]} on ${row.topic.name}`} title="Replay: a new puzzle, not counted" onClick={() => void replay(row)} disabled={opening === row.topic.id}>
            <RotateCw />
          </Button>
        </div>
      ))}
    </div>
  );
}
