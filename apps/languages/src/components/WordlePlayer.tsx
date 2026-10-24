import { useMemo, useState, type FormEvent } from "react";
import { Button, Card, CardContent, Field, Input, cn, toast } from "@lifeline/ui";
import { useDocument } from "@lifeline/core";
import { Flag, Play } from "lucide-react";
import { keyboardLetters, letterMarks, lettersOf, MAX_GUESSES, wordleRows } from "../domain/puzzle";
import { WORD, type Puzzle, type Word } from "../domain/types";
import { FORMAT_LABEL, giveUpPuzzle, guessPuzzle } from "../data/puzzles";
import { useTopics, useWords } from "../data/repo";
import { LetterKeyboard, MARK_CLASS, MARK_LABEL } from "./LetterKeyboard";
import { OriginLine } from "./OriginLine";

/**
 * A Wordle-like Puzzle (CONTEXT.md "Puzzle", ADR 0106): shown a Word's
 * meaning, guess its term in six. Typed on the device's own keyboard or the
 * on-screen one (letters of the Topic's kept terms), any word of the right length; matched without case or accents. Ends on the
 * Word in full and a way to practise. Never writes a Recall.
 */
export function WordlePlayer({ puzzle, topicName, onBack, onPractise }: { puzzle: Puzzle; topicName: string; onBack: () => void; onPractise: () => void }) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const draw = puzzle.drawn[0];
  const answer = lettersOf(draw?.answer ?? "") ?? [];
  const topic = useTopics().find((t) => t.id === puzzle.languageId);
  const enye = !!topic?.enyeOwn;
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
      await guessPuzzle(puzzle.id, draft);
      setDraft("");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function giveUp() {
    try {
      await giveUpPuzzle(puzzle.id);
    } catch (err) {
      toast.error(`Couldn't give up: ${(err as Error).message}`);
    }
  }

  const typed = Array.from(draft.trim()).slice(0, answer.length);
  const press = (letter: string) => setDraft((d) => (Array.from(d.trim()).length < answer.length ? d.trim() + letter : d));
  const erase = () => setDraft((d) => Array.from(d.trim()).slice(0, -1).join(""));
  const blankRows = Math.max(0, MAX_GUESSES - rows.length - (over ? 0 : 1));

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
        <WordlePlayed puzzle={puzzle} onPractise={onPractise} onBack={onBack} />
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
            <Button type="button" variant="ghost" onClick={() => void giveUp()}>
              <Flag /> Give up
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** The end: the Word in full, as kept now — or as drawn, once deleted — and a way to practise it. */
function WordlePlayed({ puzzle, onPractise, onBack }: { puzzle: Puzzle; onPractise: () => void; onBack: () => void }) {
  const draw = puzzle.drawn[0];
  const live = useDocument<Word>(draw?.itemId || undefined);
  const word = live && live.type === WORD ? live : undefined;
  return (
    <Card className="py-0">
      <CardContent className="grid gap-2 px-4 py-4">
        <span className={cn("text-sm font-medium", puzzle.outcome === "solved" ? "text-success" : "text-muted-foreground")}>{puzzle.outcome === "solved" ? `Solved in ${puzzle.guesses.length}` : "Unsolved"}</span>
        <p className="text-xl font-semibold">{word?.term || draw?.answer}</p>
        <p className="text-sm">{word?.meaning || draw?.clue}</p>
        {word?.notes && <p className="text-muted-foreground text-sm whitespace-pre-wrap">{word.notes}</p>}
        {word ? <OriginLine originId={word.originId} origin={word.origin} /> : <span className="text-muted-foreground text-xs">This word has since been deleted.</span>}
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
