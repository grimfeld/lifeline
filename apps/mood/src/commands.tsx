import type { CommandDef } from "@lifeline/core";
import { Smile } from "lucide-react";
import { SetMoodDialog } from "./components/SetMoodDialog";
import { MOOD_HREF } from "./domain/types";

export const moodCommands: CommandDef[] = [
  { id: "mood.set", title: "Set mood…", keywords: ["mood", "feel", "felt", "day", "journal", "happy", "sad"], icon: Smile, dialog: SetMoodDialog, capture: true },
  { id: "mood.open", title: "Go to Mood", keywords: ["mood", "grid", "year", "month", "feelings"], icon: Smile, run: ({ navigate }) => navigate(MOOD_HREF) },
];
