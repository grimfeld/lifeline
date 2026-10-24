import { useMemo, useState } from "react";
import { Button, cn } from "@lifeline/ui";
import { Flag, Play, Shuffle, X } from "lucide-react";
import { connectionsState, GROUP_SIZE, MAX_MISTAKES } from "../domain/connections";
import { guessPuzzle } from "../data/puzzles";
import { PuzzleMaterial } from "./PuzzleMaterial";
import { giveUp, PuzzleEnd, PuzzleShell, tallied, type PlayerProps } from "./PuzzleShell";

/**
 * A Connections Puzzle (CONTEXT.md "Puzzle", ADR 0106): 16 items — Word terms
 * and Fact answers — to sort into 4 of the Topic's Decks. Pick four and submit;
 * a right group shows under its Deck's name, and four mistakes end it. Ends on
 * every item in full and a way to practise. Never writes a Recall.
 */
export function ConnectionsPlayer({ puzzle, topicName, onBack, onPractise }: PlayerProps) {
  const state = useMemo(() => connectionsState(puzzle), [puzzle]);
  const [picked, setPicked] = useState<string[]>([]);
  const [order, setOrder] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const over = puzzle.outcome !== "playing";

  // Shuffling only moves the tiles on screen; the Puzzle keeps what it drew.
  const tiles = useMemo(() => {
    if (!order) return state.left;
    const rank = new Map(order.map((id, i) => [id, i]));
    return [...state.left].sort((a, b) => (rank.get(a.itemId) ?? 0) - (rank.get(b.itemId) ?? 0));
  }, [state.left, order]);

  function toggle(id: string) {
    setError("");
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < GROUP_SIZE ? [...p, id] : p));
  }

  async function submit() {
    try {
      tallied(await guessPuzzle(puzzle.id, picked));
      setPicked([]);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function shuffle() {
    const ids = state.left.map((d) => d.itemId);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    }
    setOrder(ids);
  }

  const mistakesLeft = Math.max(0, MAX_MISTAKES - state.mistakes);

  return (
    <PuzzleShell puzzle={puzzle} topicName={topicName} onBack={onBack}>
      {over ? (
        <PuzzleEnd puzzle={puzzle} status={puzzle.outcome === "solved" ? `Solved, ${state.mistakes} mistake${state.mistakes === 1 ? "" : "s"}` : `Unsolved · ${state.found.length} of ${state.groups.length} groups found`} onPractise={onPractise} onBack={onBack}>
          {state.groups.map((g, i) => (
            <section key={g.deck + g.items[0]?.itemId} className="grid gap-2">
              <h3 className={cn("text-sm font-medium", i < state.found.length ? "text-success" : "text-muted-foreground")}>{g.deck}</h3>
              <ul className="grid gap-2">
                {g.items.map((d) => (
                  <PuzzleMaterial key={d.itemId} draw={d} />
                ))}
              </ul>
            </section>
          ))}
        </PuzzleEnd>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">Sort these into four of your decks, four in each.</p>

          {state.found.length > 0 && (
            <div className="grid gap-1.5" role="list" aria-label="Groups found">
              {state.found.map((g) => (
                <div key={g.deck + g.items[0]?.itemId} role="listitem" className="bg-success text-success-foreground grid gap-0.5 rounded-lg border px-3 py-2 text-center text-sm">
                  <span className="font-semibold">{g.deck}</span>
                  <span>{g.items.map((d) => d.answer).join(" · ")}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Items left">
            {tiles.map((d) => {
              const on = picked.includes(d.itemId);
              return (
                <button
                  key={d.itemId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(d.itemId)}
                  className={cn(
                    "focus-visible:ring-ring grid min-h-14 min-w-0 place-items-center rounded-md border px-1 py-2 text-center text-sm font-medium focus-visible:ring-2 focus-visible:outline-none",
                    on ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent",
                  )}
                >
                  {d.answer}
                </button>
              );
            })}
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-sm" aria-live="polite">
            <span>
              {mistakesLeft} of {MAX_MISTAKES} mistakes left
            </span>
            {state.oneAway && <span className="text-warning font-medium">One away…</span>}
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button className="flex-1" disabled={picked.length !== GROUP_SIZE} onClick={() => void submit()}>
              <Play /> Submit
            </Button>
            <Button variant="outline" disabled={!picked.length} onClick={() => setPicked([])}>
              <X /> Deselect
            </Button>
            <Button variant="outline" onClick={shuffle}>
              <Shuffle /> Shuffle
            </Button>
            <Button variant="ghost" onClick={() => void giveUp(puzzle)}>
              <Flag /> Give up
            </Button>
          </div>
        </>
      )}
    </PuzzleShell>
  );
}
