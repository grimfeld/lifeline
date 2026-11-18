import { Minus, Plus } from "lucide-react";
import { Button } from "./button";
import { Field } from "./field";
import { LengthPicker } from "./length-picker";
import { Tip } from "./tooltip";

/**
 * The **quick timing controls** (ADR 0124): one set, drawn the same wherever
 * something is timed — the Event Form (adding and in its Peek), a Time block's
 * timing and another App's Timed item's in a Peek. A Start `step` minutes
 * earlier or later, Tomorrow, and a length in one tap. Each part shows only
 * where its handler is given: no `onNudge` for something all day, no
 * `onTomorrow` for something already tomorrow, no `onLength` where an End is
 * asked instead. The caller works out what each control does to its own when.
 */
export function QuickTiming({
  step,
  onNudge,
  nudgeDisabled = false,
  onTomorrow,
  length,
  onLength,
  lengthHint,
}: {
  /** How far one nudge moves the Start, in minutes. */
  step: number;
  /** Moves the Start by the minutes given (`-step` or `step`). */
  onNudge?: (minutes: number) => void;
  /** The nudges are shown but can't act (no readable Start yet). */
  nudgeDisabled?: boolean;
  onTomorrow?: () => void;
  length?: number | null;
  onLength?: (minutes: number) => void;
  /** Under the length, where nothing else says where it ends ("Ends 11:00"); with it the length is a labelled Field. */
  lengthHint?: string;
}) {
  const picker = onLength && <LengthPicker value={length ?? null} onChange={(m) => m && m !== length && onLength(m)} />;
  return (
    <>
      {(onNudge || onTomorrow) && (
        <div role="group" aria-label="Quick timing" className="flex flex-wrap items-center gap-1.5">
          {onNudge && (
            <>
              <Tip label={`${step} minutes earlier`}>
                <Button type="button" size="icon" variant="outline" disabled={nudgeDisabled} onClick={() => onNudge(-step)}>
                  <Minus />
                </Button>
              </Tip>
              <Tip label={`${step} minutes later`}>
                <Button type="button" size="icon" variant="outline" disabled={nudgeDisabled} onClick={() => onNudge(step)}>
                  <Plus />
                </Button>
              </Tip>
            </>
          )}
          {onTomorrow && (
            <Button type="button" size="sm" variant="outline" onClick={onTomorrow}>
              Tomorrow
            </Button>
          )}
        </div>
      )}
      {picker &&
        (lengthHint ? (
          <Field label="Length" hint={lengthHint}>
            {picker}
          </Field>
        ) : (
          picker
        ))}
    </>
  );
}
