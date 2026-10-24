import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardContent, cn, toast } from "@lifeline/ui";
import { ChevronLeft, ChevronRight, Flag, Play } from "lucide-react";
import { crosswordCells, crosswordClues, type CrosswordClue, type Direction } from "../domain/crossword";
import { fold, keyboardLetters, lettersOf, type Mark } from "../domain/puzzle";
import type { Puzzle } from "../domain/types";
import { FORMAT_LABEL, enterCrossword, giveUpPuzzle } from "../data/puzzles";
import { useTopics, useWords } from "../data/repo";
import { LetterKeyboard } from "./LetterKeyboard";
import { PuzzleMaterial } from "./PuzzleMaterial";

const NO_MARKS: ReadonlyMap<string, Mark> = new Map();
const at = (r: number, c: number) => `${r},${c}`;

/**
 * A crossword Puzzle (CONTEXT.md "Puzzle", ADR 0106): 5–8 of a Topic's kept
 * answers crossing on a free-form grid. Tap a cell to pick it (again to turn
 * across/down), or a clue; type on the on-screen keyboard or a physical
 * one; letters match without case or accents. Solved when every cell is
 * right. Ends on the material in full. Never writes a Recall.
 */
export function CrosswordPlayer({ puzzle, topicName, onBack, onPractise }: { puzzle: Puzzle; topicName: string; onBack: () => void; onPractise: () => void }) {
  const topic = useTopics().find((t) => t.id === puzzle.languageId);
  const enye = !!topic?.enyeOwn;
  const words = useWords();
  const over = puzzle.outcome !== "playing";
  const clues = useMemo(() => crosswordClues(puzzle), [puzzle]);
  const stored = useMemo(() => crosswordCells(puzzle), [puzzle]);
  // What was typed but may not be written back yet: shown at once, so fast typing never lags.
  const [typed, setTyped] = useState<Map<string, string>>(() => new Map());
  const [clueAt, setClueAt] = useState(0);
  const [cellAt, setCellAt] = useState(0);
  useEffect(() => {
    setTyped(new Map());
    setClueAt(0);
    setCellAt(0);
  }, [puzzle.id]);

  const entry = (k: string) => typed.get(k) ?? stored.find((c) => at(c.row, c.col) === k)?.entry ?? "";
  const clue = clues[clueAt];
  const cell = clue?.cells[cellAt];
  const rows = Math.max(0, ...stored.map((c) => c.row + 1));
  const cols = Math.max(0, ...stored.map((c) => c.col + 1));
  const numbers = useMemo(() => new Map(clues.map((c) => [at(c.at.row, c.at.col), c.number])), [clues]);
  const inClue = new Set(clue?.cells.map(([r, c]) => at(r, c)));

  const keys = useMemo(
    () => keyboardLetters(words.filter((w) => w.languageId === puzzle.languageId).map((w) => w.term), enye, puzzle.drawn.map((d) => d.answer)),
    [words, puzzle.languageId, puzzle.drawn, enye],
  );

  function write(row: number, col: number, letter: string) {
    setTyped((m) => new Map(m).set(at(row, col), letter));
    enterCrossword(puzzle.id, [{ row, col, letter }]).catch((e: Error) => toast.error(`Couldn't keep that letter: ${e.message}`));
  }

  function pick(row: number, col: number) {
    const through = clues.map((c, i) => ({ i, j: c.cells.findIndex(([r, cc]) => r === row && cc === col) })).filter((x) => x.j >= 0);
    if (!through.length) return;
    const same = cell && cell[0] === row && cell[1] === col;
    // Tapping the picked cell again turns to the other answer through it.
    const next = same ? (through.find((x) => x.i !== clueAt) ?? through[0]!) : (through.find((x) => x.i === clueAt) ?? through[0]!);
    setClueAt(next.i);
    setCellAt(next.j);
  }

  function goClue(step: number) {
    if (!clues.length) return;
    setClueAt((i) => (i + step + clues.length) % clues.length);
    setCellAt(0);
  }

  function press(letter: string) {
    if (!clue || !cell) return;
    write(cell[0], cell[1], letter);
    if (cellAt < clue.cells.length - 1) setCellAt(cellAt + 1);
  }

  function erase() {
    if (!clue || !cell) return;
    if (entry(at(cell[0], cell[1]))) return write(cell[0], cell[1], "");
    if (cellAt === 0) return;
    const back = clue.cells[cellAt - 1]!;
    setCellAt(cellAt - 1);
    write(back[0], back[1], "");
  }

  // A physical keyboard types, deletes, and moves between clues.
  const keysRef = useRef({ press, erase, goClue });
  keysRef.current = { press, erase, goClue };
  useEffect(() => {
    if (over) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || t?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "Backspace") keysRef.current.erase();
      else if (e.key === "Enter") keysRef.current.goClue(e.shiftKey ? -1 : 1);
      else if (e.key.length === 1 && lettersOf(e.key)?.length === 1) keysRef.current.press(fold(e.key, enye));
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [over, enye]);

  async function giveUp() {
    try {
      await giveUpPuzzle(puzzle.id);
    } catch (err) {
      toast.error(`Couldn't give up: ${(err as Error).message}`);
    }
  }

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

      {!over && clue && (
        <Card className="py-0">
          <CardContent className="flex items-start gap-2 px-3 py-3">
            <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="Previous clue" onClick={() => goClue(-1)}>
              <ChevronLeft />
            </Button>
            <ClueText clue={clue} className="min-w-0 flex-1" />
            <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="Next clue" onClick={() => goClue(1)}>
              <ChevronRight />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* One track per column, shrinking to fit a phone; a grid wider than that scrolls sideways. */}
      <div className="overflow-x-auto" data-scroll-x>
        <div role="grid" aria-label="Crossword" className="mx-auto grid w-max gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(1.75rem, 2.25rem))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
          {stored.map((c) => {
            const k = at(c.row, c.col);
            const value = entry(k);
            const picked = !over && cell?.[0] === c.row && cell?.[1] === c.col;
            const wrong = over && fold(value, enye) !== fold(c.letter, enye);
            return (
              <button
                key={k}
                type="button"
                role="gridcell"
                disabled={over}
                aria-label={`Row ${c.row + 1}, column ${c.col + 1}${value ? `, ${value}` : ", empty"}`}
                onClick={() => pick(c.row, c.col)}
                style={{ gridRow: c.row + 1, gridColumn: c.col + 1 }}
                className={cn(
                  "bg-card focus-visible:ring-ring relative grid aspect-square place-items-center rounded-sm border text-base font-semibold uppercase focus-visible:ring-2 focus-visible:outline-none",
                  inClue.has(k) && !over && "bg-accent",
                  picked && "border-foreground ring-foreground ring-1",
                  over && (wrong ? "text-destructive" : "text-success"),
                )}
              >
                {numbers.has(k) && <span className="text-muted-foreground absolute top-0 left-0.5 text-2xs leading-none font-medium">{numbers.get(k)}</span>}
                {over ? c.letter : value}
              </button>
            );
          })}
        </div>
      </div>

      {over ? (
        <CrosswordPlayed puzzle={puzzle} onPractise={onPractise} onBack={onBack} />
      ) : (
        <>
          <LetterKeyboard letters={keys} marks={NO_MARKS} onLetter={press} onDelete={erase} onEnter={() => goClue(1)} />
          <ClueList clues={clues} current={clueAt} onPick={(i) => {
              setClueAt(i);
              setCellAt(0);
            }} />
          <Button type="button" variant="ghost" className="justify-self-start" onClick={() => void giveUp()}>
            <Flag /> Give up
          </Button>
        </>
      )}
    </div>
  );
}

const DIR_LABEL: Record<Direction, string> = { across: "Across", down: "Down" };

function ClueText({ clue, className }: { clue: CrosswordClue; className?: string }) {
  return (
    <span className={cn("grid gap-0.5", className)}>
      <span className="text-muted-foreground text-xs">
        {clue.number} {DIR_LABEL[clue.dir].toLowerCase()} · {clue.cells.length} letters
      </span>
      <span className="text-sm font-medium">{clue.draw.clue}</span>
      {clue.draw.hint && <span className="text-muted-foreground text-sm">{clue.draw.hint}</span>}
    </span>
  );
}

/** Every clue, across then down; one tap picks it. */
function ClueList({ clues, current, onPick }: { clues: CrosswordClue[]; current: number; onPick: (i: number) => void }) {
  return (
    <div className="grid gap-3">
      {(["across", "down"] as const).map((dir) => {
        const mine = clues.map((c, i) => ({ c, i })).filter((x) => x.c.dir === dir);
        if (!mine.length) return null;
        return (
          <section key={dir} className="grid gap-1">
            <h3 className="text-muted-foreground text-sm font-medium">{DIR_LABEL[dir]}</h3>
            <ul className="grid gap-1">
              {mine.map(({ c, i }) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onPick(i)}
                    className={cn("hover:bg-accent focus-visible:ring-ring grid w-full min-w-0 grid-cols-[auto_1fr] gap-x-2 rounded-lg border px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:outline-none", i === current && "bg-accent")}
                  >
                    <span className="text-muted-foreground tabular-nums">{c.number}</span>
                    <span className="min-w-0">
                      {c.draw.clue}
                      {c.draw.hint && <span className="text-muted-foreground block">{c.draw.hint}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** The end: each answer's material in full, and a way to practise. */
function CrosswordPlayed({ puzzle, onPractise, onBack }: { puzzle: Puzzle; onPractise: () => void; onBack: () => void }) {
  return (
    <Card className="py-0">
      <CardContent className="grid gap-2 px-4 py-4">
        <span className={cn("text-sm font-medium", puzzle.outcome === "solved" ? "text-success" : "text-muted-foreground")}>{puzzle.outcome === "solved" ? "Solved" : "Unsolved"}</span>
        <ul className="grid gap-2">
          {puzzle.drawn.map((d) => (
            <PuzzleMaterial key={`${d.itemId}|${d.slot}`} draw={d} />
          ))}
        </ul>
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
