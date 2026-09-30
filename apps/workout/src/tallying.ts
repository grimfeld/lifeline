import type { TallyingDef, TallyValueDef } from "@lifeline/core";
import { WORKOUT } from "./domain/types";

/** What a Session measures for a Tally beyond "one": its length in minutes. */
export const SESSION_TALLY_VALUES: TallyValueDef[] = [{ id: "duration", label: "+ duration (min)" }];

/** Tallying (ADR 0059): a Workout's occurrence is a saved Session. */
export const workoutTallying: TallyingDef[] = [{ typeId: WORKOUT, occurrence: "session", values: SESSION_TALLY_VALUES }];
