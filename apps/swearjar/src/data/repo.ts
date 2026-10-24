import { useMemo } from "react";
import { documentsOf, editQueue, getDocument, normalizeTags, patchDocument, putDocument, removeDocument, useDocuments, type Document } from "@lifeline/core";
import { isColorSlot } from "@lifeline/ui";
import { FINE, OFFENCE, firstGrapheme, type Fine, type Offence } from "../domain/types";
import { dayKeyOf } from "../domain/derive";
import { formatCents } from "../domain/money";

/** PocketBase returns absent fields as "" / undefined; re-establish shapes on read. */
function normalizeOffence(o: Offence): Offence {
  return { ...o, name: o.name || o.title || "", price: Number(o.price) || 0, emoji: firstGrapheme(o.emoji ?? ""), color: isColorSlot(o.color) ? o.color : "", archived: !!o.archived, tags: o.tags ?? [] };
}

function normalizeFine(f: Fine): Fine {
  return { ...f, offenceId: f.offenceId ?? "", amount: Number(f.amount) || 0, occurredAt: f.occurredAt || f.createdAt, note: f.note ?? "", tags: f.tags ?? [] };
}

// ---- Reads ----

export function useOffences(): Offence[] {
  const rows = useDocuments<Offence>(OFFENCE);
  return useMemo(() => rows.map(normalizeOffence), [rows]);
}

export async function allOffences(): Promise<Offence[]> {
  return (await documentsOf<Offence>(OFFENCE)).map(normalizeOffence);
}

export function useFines(): Fine[] {
  const rows = useDocuments<Fine>(FINE);
  return useMemo(() => rows.map(normalizeFine), [rows]);
}

// ---- Offences ----

export interface OffenceInput {
  name: string;
  /** Integer cents, above zero. */
  price: number;
  /** The face: one grapheme or "". */
  emoji?: string;
  color?: string;
  tags?: string[];
}

function offenceRowOf(input: OffenceInput) {
  const name = input.name.trim();
  if (!name) throw new Error("Give the offence a name");
  if (!(input.price > 0)) throw new Error("Price must be above zero");
  return { type: OFFENCE, title: name, name, price: Math.round(input.price), emoji: firstGrapheme(input.emoji ?? ""), color: isColorSlot(input.color) ? input.color : "", folder: "", tags: normalizeTags(input.tags ?? []) } as const;
}

export async function addOffence(input: OffenceInput): Promise<string> {
  const row = await putDocument<Offence>({ ...offenceRowOf(input), archived: false } as Offence);
  return row.id;
}

/** Repricing touches no Fine already logged — each keeps what it cost then (ADR 0083). */
export async function updateOffence(o: Offence, input: OffenceInput): Promise<void> {
  await putDocument<Offence>({ ...o, ...offenceRowOf(input) });
}

/** Archived: out of the logging picker, its past Fines and months kept whole. */
export async function setOffenceArchived(id: string, archived: boolean): Promise<void> {
  await patchDocument(id, { archived });
}

/**
 * Hard delete only when it has no Fines — a used Offence is archived instead
 * (ADR 0083). The type's `onDelete` guard is what refuses, so the Vault and a
 * Base are held to it too.
 */
export async function deleteOffence(id: string): Promise<void> {
  await removeDocument(id);
}

/** The `onDelete` guard: throwing leaves the Offence in place. */
export async function refuseDeletingUsedOffence(doc: Document): Promise<void> {
  const fines = await documentsOf<Fine>(FINE);
  if (fines.some((f) => !f.deleted && f.offenceId === doc.id)) throw new Error("This offence has fines — archive it instead");
}

// ---- Fines ----

function fineTitle(o: Pick<Offence, "name">, amount: number, occurredAt: string): string {
  return `${formatCents(amount)} · ${o.name} · ${dayKeyOf(occurredAt)}`;
}

/**
 * Log one incident (ADR 0083): the Fine takes the Offence's price as it is
 * right now, and keeps it. `occurredAt` defaults to now; backdating allowed.
 */
export async function logFine(o: Offence, opts?: { occurredAt?: string; note?: string }): Promise<string> {
  if (o.archived) throw new Error(`${o.name} is archived`);
  if (!(o.price > 0)) throw new Error("The offence has no price");
  const occurredAt = opts?.occurredAt ?? new Date().toISOString();
  const row = await putDocument<Fine>({ type: FINE, title: fineTitle(o, o.price, occurredAt), offenceId: o.id, amount: o.price, occurredAt, note: opts?.note?.trim() ?? "", folder: "", tags: [] });
  return row.id;
}

/** Only the moment and the note are editable — the amount is a fact and the Offence is its identity. */
export async function updateFine(f: Fine, o: Pick<Offence, "name"> | undefined, input: { occurredAt: string; note: string }): Promise<void> {
  await putDocument<Fine>({ ...f, occurredAt: input.occurredAt, note: input.note.trim(), title: fineTitle(o ?? { name: "Offence" }, f.amount, input.occurredAt) });
}

/** A mis-tap is not an incident — a Fine is simply deleted. */
export async function deleteFine(id: string): Promise<void> {
  await removeDocument(id);
}

const inTurn = editQueue();

/**
 * Move a Fine's moment or change its note from its Peek (ADR 0085), through
 * `updateFine` — the amount and the Offence stay the facts they are. Each edit
 * runs over the Fine as stored at that moment, one after another, so a Peek
 * closed with both typed in keeps both.
 */
export function editFine(id: string, patch: Partial<{ occurredAt: string; note: string }>): Promise<void> {
  return inTurn(async () => {
    const row = await getDocument<Fine>(id);
    if (!row || row.type !== FINE) return;
    const f = normalizeFine(row);
    const o = (await allOffences()).find((x) => x.id === f.offenceId);
    await updateFine(f, o, { occurredAt: f.occurredAt, note: f.note, ...patch });
  });
}
