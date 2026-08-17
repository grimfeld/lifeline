import type { DaylogItem } from "@lifeline/core";
import { dayKey, formatValue } from "./aggregate";
import type { Entry, Stat } from "./types";

export const APP_ID = "stats";

export function statHref(statId: string): string {
  return `/app/stats/${statId}`;
}

/** Local "HH:MM" of an ISO instant. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
}

/**
 * The Daylog facts of the Stats App for one local day: every Entry whose `ts`
 * falls on `day` (a "YYYY-MM-DD" key), phrased per kind. Boolean stats collapse
 * to one "Marked" line per stat per day (duplicates are meaningless, see
 * `markedDays`), and carry no time. Entries of unknown/deleted stats are skipped.
 */
export function daylogEntries(stats: Stat[], entries: Entry[], day: string): DaylogItem[] {
  const byId = new Map(stats.map((s) => [s.id, s]));
  const out: DaylogItem[] = [];
  const markedStats = new Set<string>();
  const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
  for (const e of sorted) {
    if (dayKey(e.ts) !== day) continue;
    const stat = byId.get(e.statId);
    if (!stat) continue;
    const href = statHref(stat.id);
    const base = { appId: APP_ID, itemId: stat.id, href, tags: stat.tags ?? [] };
    switch (stat.kind) {
      case "additive":
        out.push({ ...base, key: `${APP_ID}/${e.id}`, kind: "Logged", title: `+${formatValue(e.value)} ${stat.unit} ${stat.name}`.replace(/\s+/g, " ").trim(), time: timeOf(e.ts) });
        break;
      case "measurement":
        out.push({ ...base, key: `${APP_ID}/${e.id}`, kind: "Measured", title: `${stat.name} ${formatValue(e.value)} ${stat.unit}`.trim(), time: timeOf(e.ts) });
        break;
      case "boolean":
        if (markedStats.has(stat.id)) break;
        markedStats.add(stat.id);
        out.push({ ...base, key: `${APP_ID}/${stat.id}/${day}`, kind: "Marked", title: stat.name, time: null });
        break;
      case "collection":
        out.push({ ...base, key: `${APP_ID}/${e.id}`, kind: "Collected", title: `${e.item} · ${stat.name}`, time: timeOf(e.ts) });
        break;
    }
  }
  return out;
}
