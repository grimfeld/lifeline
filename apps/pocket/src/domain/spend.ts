import type { DateStr } from "@lifeline/core";
import { bucketOf } from "./period";
import type { Allowance } from "./types";

/**
 * The Allowance a headless Spend goes into: by id, or by name among those
 * whose period covers the Spend's day — "Eating out" is a new Allowance each
 * month, and the one meant is the one running then. Never a guess.
 */
export function allowanceFor(value: string, allowances: readonly Allowance[], date: DateStr): Allowance {
  const byId = allowances.find((a) => a.id === value);
  if (byId) return byId;
  const wanted = value.trim().toLowerCase();
  const hits = allowances.filter((a) => a.name.trim().toLowerCase() === wanted && bucketOf(a, date) === "current");
  if (hits.length === 1) return hits[0];
  if (hits.length === 0) throw new Error(`No allowance called “${value}” runs on ${date}`);
  throw new Error(`${hits.length} allowances called “${value}” run on ${date}; pass one id: ${hits.map((a) => a.id).join(", ")}`);
}
