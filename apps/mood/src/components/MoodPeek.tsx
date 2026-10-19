import { closePeek, type Document } from "@lifeline/core";
import { Button, toast } from "@lifeline/ui";
import { clearMood, setMood } from "../data/repo";
import { readLevel } from "../domain/grid";
import { MoodPicker } from "./MoodPicker";

/** A refused pick is said in a sentence, the store's reason beneath it. */
const failed = (what: string) => (e: unknown) => void toast.error(what, { description: e instanceof Error ? e.message : String(e) });

/**
 * A Mood's editable Peek (ADR 0085): the day's mood changed in place with the
 * same five buttons as "Set mood…", through `setMood` (at most one per day),
 * or cleared back to nothing recorded — which takes the Mood, and the Peek.
 */
export function MoodPeek({ doc }: { doc: Document }) {
  const day = doc.title;
  const current = readLevel(doc.level);
  return (
    <div className="flex flex-col gap-3">
      <MoodPicker current={current} onPick={(level) => void (level === current ? Promise.resolve() : setMood(day, level)).catch(failed("Couldn’t set the mood"))} />
      {current !== null && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => void clearMood(day).then(closePeek, failed("Couldn’t clear this day"))}>
            Clear this day
          </Button>
        </div>
      )}
    </div>
  );
}
