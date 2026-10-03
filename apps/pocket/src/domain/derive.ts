import type { DateStr } from "@lifeline/core";
import type { Allowance, Bucket, Spend } from "./types";
import { bucketOf, nextFrom, spanOf } from "./period";

/**
 * Derivations (ADR 0037): what is left, the buckets, what renewal would
 * make. Nothing here is stored — every number is read off the Allowances
 * and their Spends on every render.
 */

export interface AllowanceRow {
  allowance: Allowance;
  spends: Spend[];
  /** Sum of its Spends, cents. */
  spent: number;
  /** Granted minus spent — negative when overspent, nothing clamps. */
  left: number;
  bucket: Bucket;
}

const newestFirst = (a: Spend, b: Spend) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

/** The Spends of one Allowance, newest day first. */
export function spendsOf(allowanceId: string, spends: Spend[]): Spend[] {
  return spends.filter((s) => s.allowanceId === allowanceId).sort(newestFirst);
}

export function leftOf(a: Allowance, spends: Spend[]): number {
  return a.amount - spendsOf(a.id, spends).reduce((s, x) => s + x.amount, 0);
}

/** One row per Allowance, with its derived numbers and bucket. */
export function allowanceRows(allowances: Allowance[], spends: Spend[], today: DateStr): AllowanceRow[] {
  // Grouped once, sorted once: not a filter-and-sort over every Spend per Allowance.
  const byAllowance = new Map<string, Spend[]>();
  for (const s of [...spends].sort(newestFirst)) {
    const list = byAllowance.get(s.allowanceId);
    if (list) list.push(s);
    else byAllowance.set(s.allowanceId, [s]);
  }
  return allowances.map((a) => {
    const own = byAllowance.get(a.id) ?? [];
    const spent = own.reduce((s, x) => s + x.amount, 0);
    return { allowance: a, spends: own, spent, left: a.amount - spent, bucket: bucketOf(a, today) };
  });
}

/**
 * How full the jar is drawn, 0..1: what is left over what was granted. Full
 * at the period's start, empty once overspent — the jar drains, it never
 * overflows (the red crack says the rest).
 */
export function jarLevel(row: Pick<AllowanceRow, "left" | "allowance">): number {
  const amount = row.allowance.amount;
  if (!(amount > 0)) return 0;
  return Math.max(0, Math.min(1, row.left / amount));
}

/** Order for lists: current first (soonest to end first), then upcoming (soonest first), then past (most recent first); ties by name. */
export function sortRows(rows: AllowanceRow[]): AllowanceRow[] {
  const rank: Record<Bucket, number> = { current: 0, upcoming: 1, past: 2 };
  return [...rows].sort((a, b) => {
    const r = rank[a.bucket] - rank[b.bucket];
    if (r !== 0) return r;
    const sa = spanOf(a.allowance);
    const sb = spanOf(b.allowance);
    if (a.bucket === "past") return sb.to.localeCompare(sa.to) || a.allowance.name.localeCompare(b.allowance.name);
    if (a.bucket === "upcoming") return sa.from.localeCompare(sb.from) || a.allowance.name.localeCompare(b.allowance.name);
    return sa.to.localeCompare(sb.to) || a.allowance.name.localeCompare(b.allowance.name);
  });
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/** The Allowance that already stands as `a`'s next period, if any — renewing twice must not double up. */
export function successorOf(a: Allowance, allowances: Allowance[]): Allowance | undefined {
  const from = nextFrom(a.period, a.from);
  if (!from) return undefined;
  return allowances.find((b) => b.id !== a.id && b.period === a.period && b.from === from && sameName(b.name, a.name));
}

/** Can this Allowance be renewed? Week / month / year only, and only while no successor exists. */
export function canRenew(a: Allowance, allowances: Allowance[]): boolean {
  return a.period !== "custom" && !successorOf(a, allowances);
}

/**
 * Ended Allowances that "Renew all ended" would clone: past, recurring
 * kind, no successor yet. An August Allowance already renewed into
 * September is left alone even though August is past.
 */
export function renewable(allowances: Allowance[], today: DateStr): Allowance[] {
  return allowances.filter((a) => bucketOf(a, today) === "past" && canRenew(a, allowances));
}
