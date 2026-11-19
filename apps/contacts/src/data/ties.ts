import { PERSON_TYPE, documentsOf, getDocument, putDocument, removeDocument, removeDocumentsWhere, useDocuments } from "@lifeline/core";
import { TIE, type Tie, type TieKind } from "../domain/types";
import { draftKind, invertKind, type TieRow } from "../domain/ties";

/** A Tie as stored, with its keys filled in for a row that lacks them. */
const normalizeTie = (t: Tie): Tie => ({ ...t, a: t.a ?? "", b: t.b ?? "", labelA: t.labelA ?? "", labelB: t.labelB ?? "" });

const touches = (t: Tie, personId: string) => t.a === personId || t.b === personId;

/** Every Tie of a Person, from either end. */
export async function tiesOf(personId: string): Promise<Tie[]> {
  return (await documentsOf<Tie>(TIE)).map(normalizeTie).filter((t) => touches(t, personId));
}

/** React hook: every Tie in this Workspace. */
export function useTies(): Tie[] {
  return useDocuments<Tie>(TIE).map(normalizeTie);
}

/** What goes with a Person: their Ties exist only between People, so they go when one does (ADR 0045). */
export async function removeTiesOf(personId: string): Promise<void> {
  await removeDocumentsWhere(TIE, (t) => touches(t as Tie, personId));
}

/** What moves with a Person between Workspaces: their Ties (ADR 0048). */
export async function tieIdsOf(personId: string): Promise<string[]> {
  return (await tiesOf(personId)).map((t) => t.id);
}

/**
 * Tie two People, once (#412). `label` is what `from` is to `to` ("mother"),
 * `toLabel` what `to` is to `from` ("daughter"): free words, both needed.
 * `kind` (ADR 0130), read from `from` to `to`, is what the words mean; absent for free words.
 */
export async function addTie(input: { from: string; to: string; label: string; toLabel: string; kind?: TieKind | undefined }): Promise<Tie> {
  if (input.from === input.to) throw new Error("A Person can't be tied to themselves");
  for (const id of [input.from, input.to]) {
    if ((await getDocument(id))?.type !== PERSON_TYPE) throw new Error("A Tie is between two People");
  }
  const labelA = input.label.trim();
  const labelB = input.toLabel.trim();
  if (!labelA || !labelB) throw new Error("A Tie needs a word for each end");
  return putDocument<Tie>({ type: TIE, title: "", a: input.from, b: input.to, labelA, labelB, ...(input.kind ? { kind: input.kind } : {}) });
}

/**
 * Change a Tie's words as `personId` reads them: `label` is what the other
 * Person is to them, `ownLabel` what they are to the other. Works from either end.
 * `kind` is read from `personId` to the other Person; absent clears it.
 * `kindRead` marks a kind only read from the old words (never stored): it is kept
 * only while the new words still form its pair (`draftKind`), so other words leave a Tie kindless.
 */
export async function updateTie(id: string, personId: string, words: { label: string; ownLabel: string; kind?: TieKind | undefined; kindRead?: boolean | undefined }): Promise<void> {
  const tie = await getDocument<Tie>(id);
  if (!tie) return;
  const label = words.label.trim();
  const ownLabel = words.ownLabel.trim();
  if (!label || !ownLabel) throw new Error("A Tie needs a word for each end");
  const fromA = tie.a === personId;
  const { kind: _old, ...rest } = tie;
  const own = draftKind({ label, ownLabel, kind: words.kind, ...(words.kindRead ? { kindRead: true as const } : {}) });
  const kind = own && (fromA ? own : invertKind(own));
  await putDocument<Tie>({ ...rest, labelA: fromA ? ownLabel : label, labelB: fromA ? label : ownLabel, ...(kind ? { kind } : {}) });
}

/**
 * Save the Tie dialog from `personId`'s page: change the words of `row`, or
 * tie them to `otherId`. `label` is what the other Person is to them,
 * `ownLabel` what they are to the other, as the page reads.
 */
export async function saveTieFrom(personId: string, row: Pick<TieRow, "id"> | undefined, input: { otherId: string; label: string; ownLabel: string; kind?: TieKind | undefined; kindRead?: boolean | undefined }): Promise<void> {
  if (row) return updateTie(row.id, personId, input);
  if (!input.otherId) throw new Error("Pick the other person.");
  await addTie({ from: personId, to: input.otherId, label: input.ownLabel, toLabel: input.label, kind: input.kind });
}

/** Remove a Tie, handing back the Tie as it was, for Undo (`restoreTie`). */
export async function removeTie(id: string): Promise<Tie> {
  const tie = await getDocument<Tie>(id);
  if (!tie) throw new Error("It is already gone");
  await removeDocument(id);
  return tie;
}

/** Undo `removeTie`: the same Tie, live again on both Persons' pages. */
export async function restoreTie(tie: Tie): Promise<void> {
  await putDocument<Tie>({ ...tie, deleted: 0 } as Tie);
}
