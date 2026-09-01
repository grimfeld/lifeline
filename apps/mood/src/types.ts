import type { DocumentTypeDef } from "@lifeline/core";
import { Smile } from "lucide-react";
import { MOOD, MOOD_HREF, MOOD_STEPS, moodLabel } from "./domain/types";
import { readLevel } from "./domain/grid";

const levelOptions = MOOD_STEPS.map((s) => ({ value: String(s.level), label: `${s.emoji} ${s.label}` }));

/**
 * The Mood (ADR 0044): how one day felt. Titled by its date, so Core's
 * per-type title uniqueness gives "at most one per day"; body-less, because
 * the writing about a day is the daily note's job. Deliberately not
 * Linkable — a date title would collide with the daily note's.
 */
export const moodTypeDef: DocumentTypeDef = {
  id: MOOD,
  label: "Moods",
  icon: Smile,
  iconName: "smile",
  titleRule: "date",
  body: "none",
  href: () => MOOD_HREF,
  order: 62,
  builtIn: true,
  fields: [{ key: "level", label: "Mood", kind: "select", options: levelOptions, column: true }],
};

/** How a Mood row reads outside the grid (a Base cell, a search hit). */
export const moodSummary = (level: unknown): string => {
  const l = readLevel(level);
  return l === null ? "—" : moodLabel(l);
};

export const moodTypeDefs: DocumentTypeDef[] = [moodTypeDef];
