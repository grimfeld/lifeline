import type { AppManifest, Document, DocumentTypeDef } from "@lifeline/core";
import { Check, Skull, Swords, TriangleAlert, Trophy } from "lucide-react";
import { LifeLevelScreen } from "./screens/LifeLevelScreen";
import { HabitDetailScreen } from "./screens/HabitDetailScreen";
import { HabitTileCard, useHabitTileOptions, useHabitTileTitle } from "./cards/HabitTileCard";
import { LogNegativeCard } from "./cards/LogNegativeCard";
import { lifelevelCommands } from "./commands";
import { lifelevelDaylog } from "./daylog";
import { habitHref, LIFELEVEL_HREF } from "./domain/daylog";
import {
  APP_ID,
  DIFFICULTIES,
  GRAVITIES,
  HABIT,
  HABIT_COMPLETION,
  NEGATIVE,
  NEGATIVE_COMPLETION,
  type HabitCompletion,
  type NegativeCompletion,
} from "./domain/types";

/** The `habit` Document type: an XP-bearing track. Only Difficulty is stored — all numbers derive (ADR 0026). */
const habitType: DocumentTypeDef = {
  id: HABIT,
  label: "Habits",
  icon: Swords,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "difficulty", label: "Difficulty", kind: "select", options: DIFFICULTIES.map((d) => ({ value: d, label: d })), required: true, column: true },
  ],
  linkable: { subtitle: (d) => String(d.difficulty ?? "") },
  href: (d) => habitHref(d.id),
  order: 45,
  builtIn: true,
};

/** The `negative` Document type: an anti-habit. Empty `affectsHabitId` = random targeting. */
const negativeType: DocumentTypeDef = {
  id: NEGATIVE,
  label: "Negative activities",
  singular: "Negative activity",
  icon: Skull,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "gravity", label: "Gravity", kind: "select", options: GRAVITIES.map((g) => ({ value: g, label: g })), required: true, column: true },
    { key: "affectsHabitId", label: "Rival habit", kind: "link", linkType: HABIT, column: true },
  ],
  linkable: { subtitle: (d) => String(d.gravity ?? "") },
  href: () => LIFELEVEL_HREF,
  order: 46,
  builtIn: true,
};

/** The `habit_completion` Document type: the positive half of the ledger. Visible, like Stat Entries. */
const habitCompletionType: DocumentTypeDef = {
  id: HABIT_COMPLETION,
  label: "Habit completions",
  icon: Check,
  titleRule: "derived",
  titleOf: (d: Document) => `Done ${String((d as HabitCompletion).occurredAt ?? "").slice(0, 10)}`,
  body: "none",
  fields: [
    { key: "habitId", label: "Habit", kind: "link", linkType: HABIT, guarded: true, required: true, column: true },
    { key: "occurredAt", label: "When", kind: "datetime", column: true },
    { key: "note", label: "Note", kind: "text", column: true },
  ],
  indexes: ["habitId"],
  href: (d) => habitHref(String((d as HabitCompletion).habitId)),
  order: 47,
  builtIn: true,
};

/**
 * The `negative_completion` Document type: the damage half of the ledger.
 * `affectedHabitId` is the persisted victim — the fixed pair or the random
 * roll's outcome, a fact never re-rolled (ADR 0026). Both links are guarded.
 */
const negativeCompletionType: DocumentTypeDef = {
  id: NEGATIVE_COMPLETION,
  label: "Negative completions",
  icon: TriangleAlert,
  titleRule: "derived",
  titleOf: (d: Document) => `Logged ${String((d as NegativeCompletion).occurredAt ?? "").slice(0, 10)}`,
  body: "none",
  fields: [
    { key: "negativeId", label: "Negative", kind: "link", linkType: NEGATIVE, guarded: true, required: true, column: true },
    { key: "affectedHabitId", label: "Hit habit", kind: "link", linkType: HABIT, guarded: true, required: true, column: true },
    { key: "occurredAt", label: "When", kind: "datetime", column: true },
    { key: "note", label: "Note", kind: "text", column: true },
  ],
  indexes: ["negativeId", "affectedHabitId"],
  href: () => LIFELEVEL_HREF,
  order: 48,
  builtIn: true,
};

/** Life Level App (life-level port, ADRs 0025/0026): loss-aversion habit RPG — decay, debt and levels, all derived. */
export const lifelevelApp: AppManifest = {
  id: APP_ID,
  title: "Life Level",
  icon: Trophy,
  color: "var(--chart-yellow)",
  types: [habitType, negativeType, habitCompletionType, negativeCompletionType],
  screens: [
    { id: "lifelevel.main", title: "Life Level", path: "lifelevel", icon: Trophy, component: LifeLevelScreen },
    { id: "lifelevel.detail", title: "Habit", path: "lifelevel/:id", component: HabitDetailScreen, hidden: true },
  ],
  cards: [
    {
      id: "lifelevel.habit",
      title: "Habit tile",
      description: "One habit's level, XP and decay pressure with one-tap completion",
      component: HabitTileCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
      settings: {
        habit: { kind: "entity", label: "Habit", required: true, useOptions: useHabitTileOptions },
      },
      instanceTitle: useHabitTileTitle,
    },
    {
      id: "lifelevel.negatives",
      title: "Log negative",
      description: "Every negative activity one tap from confession",
      component: LogNegativeCard,
      tagFilterable: true,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
    },
  ],
  commands: lifelevelCommands,
  daylog: lifelevelDaylog,
};

export { HABIT, NEGATIVE, HABIT_COMPLETION, NEGATIVE_COMPLETION };
export type { Habit, Negative, HabitCompletion, NegativeCompletion, Difficulty, Gravity } from "./domain/types";
