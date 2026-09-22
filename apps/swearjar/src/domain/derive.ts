import type { Fine, Offence } from "./types";

/** A calendar month, local time: "2026-09". */
export type MonthKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "YYYY-MM-DD" of an ISO instant. */
export function dayKeyOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local "HH:MM" of an ISO instant. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The local calendar month an ISO instant falls in. */
export function monthKeyOf(iso: string): MonthKey {
  return dayKeyOf(iso).slice(0, 7);
}

/** The month `delta` months from `month` (negative goes back). */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split("-").map(Number);
  const i = y * 12 + (m - 1) + delta;
  return `${Math.floor(i / 12)}-${pad((i % 12) + 1)}`;
}

/** "September 2026". */
export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/**
 * The jar for one month (ADR 0054): the month's Fines, newest first. Nothing
 * is emptied or reset — the month turning is all that makes a jar read zero.
 */
export function finesIn(fines: Fine[], month: MonthKey): Fine[] {
  return fines.filter((f) => monthKeyOf(f.occurredAt) === month).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** What the jar holds: the sum of the Fines' own amounts, never today's prices. */
export function jarTotal(fines: Fine[]): number {
  return fines.reduce((s, f) => s + f.amount, 0);
}

export interface OffenceTally {
  offenceId: string;
  /** Undefined when the Offence is gone (a sync race) — its Fines still count. */
  offence: Offence | undefined;
  count: number;
  total: number;
}

/** One month's Fines per Offence, costliest first — the count × price breakdown. */
export function tallyByOffence(offences: Offence[], fines: Fine[]): OffenceTally[] {
  const byId = new Map(offences.map((o) => [o.id, o]));
  const rows = new Map<string, OffenceTally>();
  for (const f of fines) {
    const row = rows.get(f.offenceId) ?? { offenceId: f.offenceId, offence: byId.get(f.offenceId), count: 0, total: 0 };
    row.count++;
    row.total += f.amount;
    rows.set(f.offenceId, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || b.count - a.count || (a.offence?.name ?? "").localeCompare(b.offence?.name ?? ""));
}

/** Offences that can still be logged against, by name. */
export function activeOffences(offences: Offence[]): Offence[] {
  return offences.filter((o) => !o.archived).sort((a, b) => a.name.localeCompare(b.name));
}
