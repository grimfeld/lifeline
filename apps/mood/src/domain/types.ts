import type { Document } from "@lifeline/core";

/** The one Document type the Mood App owns (ADR 0044). */
export const MOOD = "mood";
export const APP_ID = "mood";

/** 1..5, worst to best. Fixed in code so a colour means the same thing in every year (ADR 0044). */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

export interface MoodStep {
  level: MoodLevel;
  emoji: string;
  label: string;
  /** The cell's colour, from the shell's chart palette. */
  color: string;
}

/** The scale. Order is worst → best; the emoji and labels come from the daily note's old `mood` field. */
export const MOOD_STEPS: MoodStep[] = [
  { level: 1, emoji: "😞", label: "Rough", color: "var(--chart-red)" },
  { level: 2, emoji: "😕", label: "Meh", color: "var(--chart-orange)" },
  { level: 3, emoji: "😐", label: "Okay", color: "var(--chart-yellow)" },
  { level: 4, emoji: "🙂", label: "Good", color: "var(--chart-aqua)" },
  { level: 5, emoji: "😄", label: "Great", color: "var(--chart-green)" },
];

export const stepOf = (level: MoodLevel): MoodStep => MOOD_STEPS[level - 1];

/** "😄 Great" — how a mood reads in a tooltip, the Daylog or a card. */
export const moodLabel = (level: MoodLevel): string => `${stepOf(level).emoji} ${stepOf(level).label}`;

/** A Mood: how one day felt. Title is the date; at most one per day (Core's title uniqueness). */
export interface Mood extends Document {
  level?: number;
}

export const MOOD_HREF = "/app/mood";
