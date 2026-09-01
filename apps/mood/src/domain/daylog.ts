import type { DaylogItem, DateStr } from "@lifeline/core";
import { APP_ID, MOOD_HREF, moodLabel } from "./types";
import { readLevel } from "./grid";
import type { Mood } from "./types";

/**
 * The Mood App's Daylog fact for one day: the day's Mood, if it has one.
 * This is what keeps mood visible in the daily note now that the note no
 * longer owns the field (ADR 0044). Untimed — a Mood is about the whole day.
 */
export function daylogMood(moods: Mood[], day: DateStr): DaylogItem[] {
  const hit = moods.find((m) => m.title === day);
  const level = readLevel(hit?.level);
  if (!hit || level === null) return [];
  return [
    {
      key: `${APP_ID}/${day}`,
      appId: APP_ID,
      itemId: hit.id,
      kind: "Felt",
      title: moodLabel(level),
      time: null,
      href: MOOD_HREF,
      tags: hit.tags ?? [],
    },
  ];
}
