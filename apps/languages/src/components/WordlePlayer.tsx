import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, CardContent, Field, Input, cn } from "@lifeline/ui";
import { Flag, Play } from "lucide-react";
import { keyboardLetters, letterMarks, lettersOf, MAX_GUESSES, wordleRows } from "../domain/puzzle";
import { guessPuzzle } from "../data/puzzles";
import { useWords } from "../data/repo";
import { LetterKeyboard, MARK_CLASS, MARK_LABEL } from "./LetterKeyboard";
import { PuzzleMaterial } from "./PuzzleMaterial";
import { giveUp, PuzzleEnd, PuzzleShell, tallied, type PlayerProps } from "./PuzzleShell";

/**
 * A Wordle-like Puzzle (CONTEXT.md "Puzzle", ADR 0106): shown a Word's
 * meaning, guess its term in six. Typed on the device's own keyboard or the
 * on-screen one (letters of the Topic's kept terms), any word of the right
 * length; matched without case or accents. Ends on the Word in full and a
 * way to practise. Never writes a Recall.
 */
export function WordlePlayer({ puzzle, topicName, onBack, onPractise }: PlayerProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const draw = puzzle.drawn[0];
  const answer = lettersOf(draw?.answer ?? "") ?? [];
  // As the Topic set it when the Puzzle was first opened, never the setting now.
  const enye = !!puzzle.enyeOwn;
  const words = useWords();
  const rows = wordleRows(puzzle, enye);
  const keys = useMemo(
    () => keyboardLetters(words.filter((w) => w.languageId === puzzle.languageId).map((w) => w.term), enye, [draw?.answer ?? "", ...puzzle.guesses]),
    [words, puzzle.languageId, puzzle.guesses, draw?.answer, enye],
  );
  const marks = useMemo(() => letterMarks(draw?.answer ?? "", puzzle.guesses, enye), [draw?.answer, puzzle.guesses, enye]);
  const over = puzzle.outcome !== "playing";

  async function guess(e?: FormEvent) {
    e?.preventDefault();
    if (!draft.trim()) return;
    try {
      tallied(await guessPuzzle(puzzle.id, draft));
      setDraft("");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const typed = Array.from(draft.trim()).slice(0, answer.length);
  const press = (letter: string) => setDraft((d) => (Array.from(d.trim()).length < answer.length ? d.trim() + letter : d));
  const erase = () => setDraft((d) => Array.from(d.trim()).slice(0, -1).join(""));
  const blankRows = Math.max(0, MAX_GUESSES - rows.length - (over ? 0 : 1));

  return (
    <PuzzleShell puzzle={puzzle} topicName={topicName} onBack={onBack}>
      <Card className="py-0">
        <CardContent className="grid gap-1 px-4 py-4">
          <span className="text-muted-foreground text-xs">Meaning</span>
          <p className="text-base font-medium">{draw?.clue}</p>
          {draw?.hint && <p className="text-muted-foreground text-sm">In a sentence: {draw.hint}</p>}
          <span className="text-muted-foreground text-xs">{answer.length} letters</span>
        </CardContent>
      </Card>

      {/* One track per letter: at most ten, sized to fit a phone's width. */}
      <div className="grid justify-center gap-1.5" role="list" aria-label="Guesses">
        {rows.map((row, r) => (
          <div key={r} role="listitem" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${answer.length}, minmax(0, 2.75rem))` }}>
            {row.map((c, i) => (
              <span key={i} className={cn("grid aspect-square place-items-center rounded-md border text-lg font-semibold uppercase", MARK_CLASS[c.mark])}>
                {c.letter}
                <span className="sr-only">, {MARK_LABEL[c.mark]}</span>
              </span>
            ))}
          </div>
        ))}
        {!over && (
          <div className="grid gap-1.5" aria-hidden style={{ gridTemplateColumns: `repeat(${answer.length}, minmax(0, 2.75rem))` }}>
            {answer.map((_, i) => (
              <span key={i} className={cn("grid aspect-square place-items-center rounded-md border text-lg font-semibold uppercase", typed[i] && "border-foreground")}>
                {typed[i] ?? ""}
              </span>
            ))}
          </div>
        )}
        {Array.from({ length: blankRows }, (_, r) => (
          <div key={`b${r}`} className="grid gap-1.5" aria-hidden style={{ gridTemplateColumns: `repeat(${answer.length}, minmax(0, 2.75rem))` }}>
            {answer.map((_, i) => (
              <span key={i} className="aspect-square rounded-md border" />
            ))}
          </div>
        ))}
      </div>

      {over ? (
        <PuzzleEnd puzzle={puzzle} status={puzzle.outcome === "solved" ? `Solved in ${puzzle.guesses.length}` : "Unsolved"} onPractise={onPractise} onBack={onBack}>
          <ul className="grid gap-2">{draw && <PuzzleMaterial draw={draw} />}</ul>
        </PuzzleEnd>
      ) : (
        <form className="grid gap-3" onSubmit={(e) => void guess(e)}>
          <Field label={`Guess ${rows.length + 1} of ${MAX_GUESSES}`} error={error}>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} enterKeyHint="go" inputMode="none" autoFocus />
          </Field>
          <LetterKeyboard letters={keys} marks={marks} onLetter={press} onDelete={erase} onEnter={() => void guess()} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="flex-1" disabled={!draft.trim()}>
              <Play /> Guess
            </Button>
            <Button type="button" variant="ghost" onClick={() => void giveUp(puzzle)}>
              <Flag /> Give up
            </Button>
          </div>
        </form>
      )}
    </PuzzleShell>
  );
}
