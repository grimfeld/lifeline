import type { CommandDef } from "@lifeline/core";
import { Plus, Skull, Swords, Trophy } from "lucide-react";
import { CompleteHabitCommandDialog, LogNegativeCommandDialog } from "./components/LogDialogs";
import { HabitEditorDialog } from "./components/HabitEditorDialog";
import { NegativeEditorDialog } from "./components/NegativeEditorDialog";
import { LIFELEVEL_HREF } from "./domain/daylog";

function NewHabitCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <HabitEditorDialog {...props} />;
}

function NewNegativeCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <NegativeEditorDialog {...props} />;
}

export const lifelevelCommands: CommandDef[] = [
  { id: "lifelevel.complete", title: "Complete habit", keywords: ["habit", "xp", "level", "done"], icon: Swords, dialog: CompleteHabitCommandDialog, capture: true },
  { id: "lifelevel.log-negative", title: "Log negative", keywords: ["negative", "vice", "bad", "confess", "damage"], icon: Skull, dialog: LogNegativeCommandDialog, capture: true },
  { id: "lifelevel.new-habit", title: "New habit", keywords: ["habit", "create", "level"], icon: Plus, dialog: NewHabitCommandDialog },
  { id: "lifelevel.new-negative", title: "New negative", keywords: ["negative", "vice", "create"], icon: Plus, dialog: NewNegativeCommandDialog },
  { id: "lifelevel.open", title: "Go to Life Level", keywords: ["life", "level", "habits", "xp"], icon: Trophy, run: ({ navigate }) => navigate(LIFELEVEL_HREF) },
];
