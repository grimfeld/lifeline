import { documentsOf, getDocument, putDocument, removeDocument, removeDocumentsWhere, useDocuments } from "@lifeline/core";
import { PERSON, TIE, type Tie } from "../domain/types";

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

const word = (s: string) => s.trim();

/**
 * Tie two People, once (#412). `label` is what `from` is to `to` ("mother"),
 * `toLabel` what `to` is to `from` ("daughter"): free words, both needed.
 */
export async function addTie(input: { from: string; to: string; label: string; toLabel: string }): Promise<Tie> {
  if (input.from === input.to) throw new Error("A Person can't be tied to themselves");
  for (const id of [input.from, input.to]) {
    if ((await getDocument(id))?.type !== PERSON) throw new Error("A Tie is between two People");
  }
  const labelA = word(input.label);
  const labelB = word(input.toLabel);
  if (!labelA || !labelB) throw new Error("A Tie needs a word for each end");
  return putDocument<Tie>({ type: TIE, title: "", a: input.from, b: input.to, labelA, labelB });
}

/**
 * Change a Tie's words as `personId` reads them: `label` is what the other
 * Person is to them, `ownLabel` what they are to the other. Works from either end.
 */
export async function updateTie(id: string, personId: string, words: { label: string; ownLabel: string }): Promise<void> {
  const tie = await getDocument<Tie>(id);
  if (!tie) return;
  const label = word(words.label);
  const ownLabel = word(words.ownLabel);
  if (!label || !ownLabel) throw new Error("A Tie needs a word for each end");
  const fromA = tie.a === personId;
  await putDocument<Tie>({ ...tie, labelA: fromA ? ownLabel : label, labelB: fromA ? label : ownLabel });
}

export async function removeTie(id: string): Promise<void> {
  await removeDocument(id);
}
