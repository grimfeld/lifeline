import { todayStr, type CommandDef } from "@lifeline/core";
import { Smile } from "lucide-react";
import { SetMoodDialog } from "./components/SetMoodDialog";
import { MOOD_HREF, MOOD_STEPS, moodLabel, moodOptions, type MoodLevel } from "./domain/types";
import { isSettable, moodOn, setMood } from "./data/repo";

export const moodCommands: CommandDef[] = [
  {
    id: "mood.set",
    title: "Set mood…",
    keywords: ["mood", "feel", "felt", "day", "journal", "happy", "sad"],
    icon: Smile,
    dialog: SetMoodDialog,
    capture: true,
    args: [
      { key: "mood", label: "Mood", kind: "select", required: true, options: moodOptions(), hint: "Worst to best: rough, meh, okay, good, great." },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to today; never a day still to come." },
    ],
    async invoke(a) {
      const date = (a.date as string | undefined) ?? todayStr();
      if (!isSettable(date)) throw new Error("A day still to come has no mood yet");
      const level = (MOOD_STEPS.findIndex((s) => s.label.toLowerCase() === a.mood) + 1) as MoodLevel;
      const current = await moodOn(date);
      if (current !== null) throw new Error(`${date} already has a mood (${moodLabel(current)}); tell the user — nothing was changed, and only the Mood App changes it`);
      await setMood(date, level);
      return { message: `Mood for ${date}: ${moodLabel(level)}` };
    },
  },
  { id: "mood.open", title: "Go to Mood", keywords: ["mood", "grid", "year", "month", "feelings"], icon: Smile, run: ({ navigate }) => navigate(MOOD_HREF) },
];
