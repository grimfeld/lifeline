import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card } from "ts-fsrs";
import type { Grade } from "./types";

/**
 * The schedule is policy (ADR 0058): FSRS with default weights, no fuzz — so
 * replaying the same Recalls always gives the same schedule, on any device.
 * One short learning step: a new Prompt passed once is spaced out at once,
 * and only a failed one comes back within the sitting. Changing any of this
 * re-values every Prompt at once.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, learning_steps: ["1m"], relearning_steps: ["10m"] }));

export type HeldState = "new" | "learning" | "review" | "relearning";

/** How a Prompt is held right now, read from its Recalls. */
export interface Held {
  state: HeldState;
  /** When it is next due; null while new. */
  due: Date | null;
  /** FSRS stability in days — how long until recall drops to 90%. */
  stability: number;
  reps: number;
  lapses: number;
}

const STATE: Record<State, HeldState> = {
  [State.New]: "new",
  [State.Learning]: "learning",
  [State.Review]: "review",
  [State.Relearning]: "relearning",
};

export interface RecallFact {
  grade: Grade;
  /** ISO instant. */
  at: string;
}

/** Pass/fail on the FSRS scale (ADR 0058): pass is Good, fail is Again — never Hard or Easy. */
function rating(g: Grade): Rating.Good | Rating.Again {
  return g === "pass" ? Rating.Good : Rating.Again;
}

/** Replay a Prompt's Recalls, oldest first, into how it is held now. No Recalls: new. */
export function replay(recalls: RecallFact[]): Held {
  const sorted = [...recalls].sort((a, b) => a.at.localeCompare(b.at));
  const first = sorted[0];
  if (!first) return { state: "new", due: null, stability: 0, reps: 0, lapses: 0 };
  let card: Card = createEmptyCard(new Date(first.at));
  for (const r of sorted) card = scheduler.next(card, new Date(r.at), rating(r.grade)).card;
  return { state: STATE[card.state], due: card.due, stability: card.stability, reps: card.reps, lapses: card.lapses };
}
