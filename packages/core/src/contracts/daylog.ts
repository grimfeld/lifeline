import type { DateStr } from "../dates";
import type { TimeStr } from "./timed";
import { appById, daylogProviders } from "../registry";

/**
 * The Daylog Contract (ADR 0009): an App reports what *happened* on a day —
 * completed tasks, chore completions, logged entries, media started or
 * finished, events. Rendered live wherever a Daylog block appears; never
 * written into a note's text.
 */
export interface DaylogItem {
  /** `${appId}/${something}` — unique across Apps for the day. */
  key: string;
  appId: string;
  itemId?: string;
  /** Verb-first: "Completed", "Done", "Logged", "Started", "Finished", "Event"… */
  kind: string;
  title: string;
  subtitle?: string;
  /** "HH:MM" when the fact has a time; null/undefined otherwise. Sorted first when present. */
  time?: TimeStr | null;
  href?: string;
}

export interface DaylogProvider {
  appId: string;
  /** React hook. Live facts for one day. */
  useItems(date: DateStr): DaylogItem[];
}

export interface SurfaceDaylogItem extends DaylogItem {
  color?: string;
}

/** Read side: every provider's facts for the day, timed first, coloured per App. */
export function useDaylog(date: DateStr, apps?: string[]): SurfaceDaylogItem[] {
  const providers = daylogProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const per = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    items: p.useItems(date),
  }));
  const out: SurfaceDaylogItem[] = [];
  for (const { provider, items } of per) {
    if (apps && apps.length > 0 && !apps.includes(provider.appId)) continue;
    const color = appById(provider.appId)?.color;
    for (const item of items) out.push({ ...item, color });
  }
  return out.sort((a, b) => {
    if (a.time && b.time) return a.time.localeCompare(b.time) || a.title.localeCompare(b.title);
    if (a.time) return -1;
    if (b.time) return 1;
    return a.appId.localeCompare(b.appId) || a.title.localeCompare(b.title);
  });
}
