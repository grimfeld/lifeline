import { toast } from "@lifeline/ui";
import { partName, type PartsMedium } from "../domain";
import type { PartsKit, PartsWork, ReadOutcome } from "../kit";

/**
 * Say what a read did. Reading the last known Part *offers* Done and never
 * sets it (CONTEXT.md, Part) — the offer is the toast's action.
 */
export function announceRead<W extends PartsWork>(kit: PartsKit<W>, work: W, medium: PartsMedium, outcome: ReadOutcome): void {
  const what = `${work.title} · ${partName(medium, outcome.pos)} — ${medium.verb.toLowerCase()}`;
  if (outcome.complete && work.engagement !== "DONE") {
    toast.success(`${what}. That was the last one.`, {
      action: { label: "Mark done", onClick: () => void kit.finish(work) },
    });
  } else toast.success(outcome.started ? `${what} · started` : what);
}

/** Run a Parts action, showing its refusal as an error toast. */
export async function attempt(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    toast.error((e as Error).message || "That didn't work");
  }
}
