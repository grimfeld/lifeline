import { momentOf, type CommandDef } from "@lifeline/core";
import { Plus, Skull, Swords, Trophy } from "lucide-react";
import { CompleteHabitCommandDialog, LogNegativeCommandDialog } from "./components/LogDialogs";
import { HabitEditorDialog } from "./components/HabitEditorDialog";
import { NegativeEditorDialog } from "./components/NegativeEditorDialog";
import { LIFELEVEL_HREF } from "./domain/daylog";
import { HABIT, NEGATIVE } from "./domain/types";
import { completeHabit, logNegative } from "./data/repo";

function NewHabitCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <HabitEditorDialog {...props} />;
}

function NewNegativeCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <NegativeEditorDialog {...props} />;
}

export const lifelevelCommands: CommandDef[] = [
  {
    id: "lifelevel.complete",
    title: "Complete habit",
    keywords: ["habit", "xp", "level", "done"],
    icon: Swords,
    dialog: CompleteHabitCommandDialog,
    capture: true,
    args: [
      { key: "habit", label: "Habit", kind: "link", linkType: HABIT, required: true },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to now; back-logging is allowed." },
      { key: "time", label: "Time", kind: "time", hint: "With a day; defaults to noon." },
      { key: "note", label: "Note", kind: "longtext" },
    ],
    async invoke(a) {
      const r = await completeHabit(a.habit as string, { occurredAt: momentOf(a.date as string | undefined, a.time as string | undefined), note: a.note as string | undefined });
      if (!r) throw new Error("That Habit no longer exists");
      const level = r.levelDelta > 0 ? `, level ${r.previousLevel} → ${r.nextLevel}` : "";
      return { id: r.completionId, message: `${r.habit.title}: +${r.xpAmount} XP${level}` };
    },
  },
  {
    id: "lifelevel.log-negative",
    title: "Log negative",
    keywords: ["negative", "vice", "bad", "confess", "damage"],
    icon: Skull,
    dialog: LogNegativeCommandDialog,
    capture: true,
    args: [
      { key: "negative", label: "Negative", kind: "link", linkType: NEGATIVE, required: true },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to now." },
      { key: "time", label: "Time", kind: "time", hint: "With a day; defaults to noon." },
      { key: "note", label: "Note", kind: "longtext" },
    ],
    async invoke(a) {
      const r = await logNegative(a.negative as string, { occurredAt: momentOf(a.date as string | undefined, a.time as string | undefined), note: a.note as string | undefined });
      if (!r) throw new Error("That Negative no longer exists");
      if (!r.ok) throw new Error(r.reason === "no-habits" ? "There is no Habit for it to hit yet" : "Its rival Habit is gone; pair it again in the App first");
      return { id: r.completionId, message: `${r.negative.title}: −${r.damage} XP to ${r.victim.title}` };
    },
  },
  { id: "lifelevel.new-habit", title: "New habit", keywords: ["habit", "create", "level"], icon: Plus, dialog: NewHabitCommandDialog },
  { id: "lifelevel.new-negative", title: "New negative", keywords: ["negative", "vice", "create"], icon: Plus, dialog: NewNegativeCommandDialog },
  { id: "lifelevel.open", title: "Go to Life Level", keywords: ["life", "level", "habits", "xp"], icon: Trophy, run: ({ navigate }) => navigate(LIFELEVEL_HREF) },
];
