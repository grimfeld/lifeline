import { Button, cn } from "@lifeline/ui";
import { CornerDownLeft, Delete } from "lucide-react";
import type { Mark } from "../domain/puzzle";

export const MARK_CLASS: Record<Mark, string> = {
  right: "bg-success text-success-foreground border-success",
  present: "bg-warning text-warning-foreground border-warning",
  absent: "bg-muted text-muted-foreground",
};

/** What a screen reader hears for each mark. */
export const MARK_LABEL: Record<Mark, string> = { right: "right place", present: "wrong place", absent: "not in the word" };

/**
 * An on-screen letter keyboard for the word Puzzles (ADR 0106): one key per
 * letter given, each coloured by what the guesses revealed of it, plus delete
 * and enter. It knows no format — a Wordle-like and a crossword both feed it
 * their letters and marks, and take the presses.
 */
export function LetterKeyboard({
  letters,
  marks,
  onLetter,
  onDelete,
  onEnter,
  disabled,
}: {
  letters: readonly string[];
  /** Per letter, the best mark so far; a letter not yet tried has none. */
  marks: ReadonlyMap<string, Mark>;
  onLetter: (letter: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  disabled?: boolean;
}) {
  const key = "shrink-0 px-0 text-base font-semibold uppercase";
  return (
    <div role="group" aria-label="Letters" className="flex flex-wrap justify-center gap-1.5">
      {letters.map((l) => {
        const mark = marks.get(l);
        return (
          <Button key={l} type="button" size="touch" variant="outline" disabled={disabled} className={cn(key, "w-9", mark && MARK_CLASS[mark])} aria-label={mark ? `${l}, ${MARK_LABEL[mark]}` : l} onClick={() => onLetter(l)}>
            {l}
          </Button>
        );
      })}
      <Button type="button" size="touch" variant="outline" disabled={disabled} className={cn(key, "w-14")} aria-label="Delete" onClick={onDelete}>
        <Delete />
      </Button>
      <Button type="button" size="touch" variant="outline" disabled={disabled} className={cn(key, "w-14")} aria-label="Enter" onClick={onEnter}>
        <CornerDownLeft />
      </Button>
    </div>
  );
}
