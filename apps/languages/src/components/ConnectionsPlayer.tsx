import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, toast } from "@lifeline/ui";
import { useDocument } from "@lifeline/core";
import { Flag, Play, Shuffle, X } from "lucide-react";
import { connectionsState, GROUP_SIZE, MAX_MISTAKES, type ConnectionsGroup } from "../domain/connections";
import { FACT, WORD, type Fact, type Puzzle, type PuzzleDraw, type Word } from "../domain/types";
import { FORMAT_LABEL, giveUpPuzzle, guessPuzzle } from "../data/puzzles";
import { OriginLine } from "./OriginLine";

/**
 * A Connections Puzzle (CONTEXT.md "Puzzle", ADR 0106): 16 items — Word terms
 * and Fact answers — to sort into 4 of the Topic's Decks. Pick four and submit;
 * a right group shows under its Deck's name, and four mistakes end it. Ends on
 * every item in full and a way to practise. Never writes a Recall.
 */
export function ConnectionsPlayer({ puzzle, topicName, onBack, onPractise }: { puzzle: Puzzle; topicName: string; onBack: () => void; onPractise: () => void }) {
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
      await guessPuzzle(puzzle.id, picked);
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

  async function giveUp() {
    try {
      await giveUpPuzzle(puzzle.id);
    } catch (err) {
      toast.error(`Couldn't give up: ${(err as Error).message}`);
    }
  }

  const mistakesLeft = Math.max(0, MAX_MISTAKES - state.mistakes);

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

      {over ? (
        <ConnectionsPlayed puzzle={puzzle} groups={state.groups} found={state.found.length} mistakes={state.mistakes} onPractise={onPractise} onBack={onBack} />
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
            <Button variant="ghost" onClick={() => void giveUp()}>
              <Flag /> Give up
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** The end: every group under its Deck's name, each item in full as kept now — or as drawn, once deleted — and a way to practise. */
function ConnectionsPlayed({ puzzle, groups, found, mistakes, onPractise, onBack }: { puzzle: Puzzle; groups: ConnectionsGroup[]; found: number; mistakes: number; onPractise: () => void; onBack: () => void }) {
  return (
    <Card className="py-0">
      <CardContent className="grid gap-3 px-4 py-4">
        <span className={cn("text-sm font-medium", puzzle.outcome === "solved" ? "text-success" : "text-muted-foreground")}>
          {puzzle.outcome === "solved" ? `Solved, ${mistakes} mistake${mistakes === 1 ? "" : "s"}` : `Unsolved · ${found} of ${groups.length} groups found`}
        </span>
        {groups.map((g, i) => (
          <section key={g.deck + g.items[0]?.itemId} className="grid gap-2">
            <h3 className={cn("text-sm font-medium", i < found ? "text-success" : "text-muted-foreground")}>{g.deck}</h3>
            <ul className="grid gap-2">
              {g.items.map((d) => (
                <PlayedItem key={d.itemId} draw={d} />
              ))}
            </ul>
          </section>
        ))}
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

/** One item at the end: a Word's term and meaning, or a Fact's answer and question, with notes and where it was met. */
function PlayedItem({ draw }: { draw: PuzzleDraw }) {
  const live = useDocument<Word | Fact>(draw.itemId || undefined);
  const word = live?.type === WORD ? (live as Word) : undefined;
  const fact = live?.type === FACT ? (live as Fact) : undefined;
  const item = word ?? fact;
  return (
    <li className="grid gap-0.5 rounded-lg border px-3 py-2">
      <span className="font-semibold">{word?.term || fact?.answer || draw.answer}</span>
      <span className="text-sm">{word?.meaning || fact?.question || draw.clue}</span>
      {item?.notes && <span className="text-muted-foreground text-sm whitespace-pre-line">{item.notes}</span>}
      {item ? <OriginLine originId={item.originId} origin={item.origin} /> : <span className="text-muted-foreground text-xs">Since deleted.</span>}
    </li>
  );
}
