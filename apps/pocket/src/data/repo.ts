import { useMemo } from "react";
import { documentsOf, normalizeTags, patchDocument, putDocument, removeDocument, removeDocumentsWhere, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import { isColorSlot } from "@lifeline/ui";
import { ALLOWANCE, SPEND, firstGrapheme, type Allowance, type PeriodKind, type Spend } from "../domain/types";
import { allowanceTitle, endOf, nextFrom, normalizeFrom } from "../domain/period";
import { successorOf } from "../domain/derive";

/** PocketBase returns absent fields as "" / undefined; re-establish shapes on read. */
function normalizeAllowance(a: Allowance): Allowance {
  const period: PeriodKind = a.period || "month";
  return { ...a, name: a.name ?? "", period, from: a.from || a.createdAt, to: period === "custom" ? a.to || "" : "", amount: Number(a.amount) || 0, emoji: firstGrapheme(a.emoji ?? ""), color: isColorSlot(a.color) ? a.color : "", tags: a.tags ?? [] };
}

function normalizeSpend(s: Spend): Spend {
  return { ...s, allowanceId: s.allowanceId ?? "", amount: Number(s.amount) || 0, date: s.date || s.createdAt, label: s.label ?? "", tags: s.tags ?? [] };
}

// ---- Reads ----

export function useAllowances(): Allowance[] {
  const rows = useDocuments<Allowance>(ALLOWANCE);
  return useMemo(() => rows.map(normalizeAllowance), [rows]);
}

export async function allAllowances(): Promise<Allowance[]> {
  return (await documentsOf<Allowance>(ALLOWANCE)).map(normalizeAllowance);
}

export async function allSpends(): Promise<Spend[]> {
  return (await documentsOf<Spend>(SPEND)).map(normalizeSpend);
}

export function useSpends(): Spend[] {
  const rows = useDocuments<Spend>(SPEND);
  return useMemo(() => rows.map(normalizeSpend), [rows]);
}

// ---- Allowances ----

export interface AllowanceInput {
  name: string;
  period: PeriodKind;
  /** Any day inside the wanted period; snapped to its first day (custom: kept). */
  from: DateStr;
  /** Custom only. */
  to?: DateStr;
  /** Integer cents. */
  amount: number;
  /** The face (CONTEXT: Allowance): one grapheme or "". */
  emoji?: string;
  color?: string;
  tags?: string[];
}

function rowOf(input: AllowanceInput): Omit<Allowance, "id" | "updatedAt" | "deleted" | "createdAt"> {
  const name = input.name.trim();
  if (!name) throw new Error("Give the allowance a name");
  if (!input.from) throw new Error("Pick when it starts");
  if (!(input.amount > 0)) throw new Error("Amount must be above zero");
  const from = normalizeFrom(input.period, input.from);
  const to = input.period === "custom" ? endOf("custom", from, input.to) : "";
  // Title is derived and re-derived on every write — the name or the period may have changed.
  return { type: ALLOWANCE, title: allowanceTitle({ name, period: input.period, from, to }), name, period: input.period, from, to, amount: Math.round(input.amount), emoji: firstGrapheme(input.emoji ?? ""), color: isColorSlot(input.color) ? input.color : "", folder: "", tags: normalizeTags(input.tags ?? []) };
}

export async function addAllowance(input: AllowanceInput): Promise<string> {
  const row = await putDocument<Allowance>(rowOf(input) as Allowance);
  return row.id;
}

/** Editing in place — no history of the change is kept (ADR 0037). */
export async function updateAllowance(a: Allowance, input: AllowanceInput): Promise<void> {
  await putDocument<Allowance>({ ...a, ...rowOf(input) });
}

/** An Allowance takes its Spends with it (the cascade precedent, ADR 0026). */
export async function deleteAllowance(id: string): Promise<void> {
  await removeDocumentsWhere(SPEND, (d) => (d as Spend).allowanceId === id);
  await removeDocument(id);
}

/**
 * Renew (ADR 0037): a fresh Allowance for the next week / month / year with
 * the same name, amount, face and tags and no Spends. Never automatic; refuses a
 * custom span and a second renewal of the same one.
 */
export async function renewAllowance(a: Allowance, allowances: Allowance[], amount?: number): Promise<string> {
  const from = nextFrom(a.period, a.from);
  if (!from) throw new Error("A custom span does not renew — make a new allowance");
  const existing = successorOf(a, allowances);
  if (existing) throw new Error(`Already renewed: ${existing.title || allowanceTitle(existing)}`);
  return addAllowance({ name: a.name, period: a.period, from, amount: amount ?? a.amount, emoji: a.emoji, color: a.color, tags: a.tags });
}

// ---- Spends ----

export interface SpendInput {
  allowanceId: string;
  /** Integer cents, above zero. */
  amount: number;
  date: DateStr;
  label?: string;
}

function spendRowOf(input: SpendInput): Omit<Spend, "id" | "updatedAt" | "deleted" | "createdAt"> {
  if (!input.allowanceId) throw new Error("Pick an allowance");
  if (!(input.amount > 0)) throw new Error("Amount must be above zero");
  return { type: SPEND, title: "", allowanceId: input.allowanceId, amount: Math.round(input.amount), date: input.date || todayStr(), label: input.label?.trim() ?? "", folder: "", tags: [] };
}

export async function addSpend(input: SpendInput): Promise<string> {
  const row = await putDocument<Spend>(spendRowOf(input) as Spend);
  return row.id;
}

export async function updateSpend(s: Spend, input: SpendInput): Promise<void> {
  await putDocument<Spend>({ ...s, ...spendRowOf(input) });
}

export async function deleteSpend(id: string): Promise<void> {
  await removeDocument(id);
}

/** Move a Spend to another Allowance — a mis-tap fixed in one step. */
export async function reassignSpend(id: string, allowanceId: string): Promise<void> {
  await patchDocument(id, { allowanceId });
}

export { todayStr };
