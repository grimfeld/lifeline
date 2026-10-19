/**
 * The context menu (ADR 0080): Send to Lifeline, and under it one entry per
 * Intake the person's Lifeline publishes (`/intakes.json`), so "Send to
 * Lifeline › Task" names the receiver in one click and a new Intake needs no
 * extension release. Pure — background.ts builds the menu from these.
 */
import { intakeListUrl, readIntakeList, type IntakeEntry } from "@lifeline/handoff";

/** One context-menu entry. An entry naming an Intake opens the Handoff page on it; one without lets the page ask. */
export interface MenuEntry {
  id: string;
  title: string;
  parentId?: string;
  type?: "separator";
}

const SEND = "send";
const INTAKE_PREFIX = "intake:";

/**
 * The menu for these Intakes: with none (the list could not be had), plain
 * Send to Lifeline; else Send to Lifeline › a plain send, then each Intake.
 * A parent entry is a submenu and cannot be chosen itself, so the plain send
 * goes under it too.
 */
export function menuEntries(intakes: IntakeEntry[] | null): MenuEntry[] {
  const send: MenuEntry = { id: SEND, title: "Send to Lifeline" };
  if (!intakes?.length) return [send];
  return [
    send,
    { id: `${SEND}:choose`, parentId: SEND, title: "Choose in Lifeline…" },
    { id: `${SEND}:separator`, parentId: SEND, title: "", type: "separator" },
    ...intakes.map(({ key, title }) => ({ id: INTAKE_PREFIX + key, parentId: SEND, title })),
  ];
}

/**
 * The Intake (`appId/intakeId`) a chosen entry names, if any. Read from the id
 * itself: the background may have been stopped and woken since it built the menu.
 */
export function intakeOfMenuItem(id: string | number): string | undefined {
  const s = String(id);
  return s.startsWith(INTAKE_PREFIX) ? s.slice(INTAKE_PREFIX.length) : undefined;
}

/** Where the last list fetched is kept (storage.local), with the Lifeline it came from. */
export interface IntakesCache {
  get(): Promise<{ base: string; intakes: IntakeEntry[] } | undefined>;
  set(value: { base: string; intakes: IntakeEntry[] }): Promise<void>;
}

/** Enough of `fetch` to ask for the list. */
export type FetchJson = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * The Intakes the Lifeline at `base` publishes, kept for when it cannot be
 * reached; else the list last kept from that same Lifeline; else null.
 */
export async function fetchIntakes(base: string, { fetch, cache }: { fetch: FetchJson; cache: IntakesCache }): Promise<IntakeEntry[] | null> {
  try {
    const res = await fetch(intakeListUrl(base));
    const intakes = res.ok ? readIntakeList(await res.json()) : null;
    if (intakes) {
      await cache.set({ base, intakes });
      return intakes;
    }
  } catch {
    /* unreachable, or not JSON: the kept list, if any */
  }
  const kept = await cache.get();
  return kept?.base === base ? kept.intakes : null;
}
