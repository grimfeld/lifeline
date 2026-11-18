import { EXCHANGE_TYPE, PERSON_TYPE, createDocument, documentsOf, documentsTable, getDocument, putDocument, removeDocument, todayStr, useDocuments, type Document } from "@lifeline/core";
import { EXCHANGES_FOLDER, type Exchange } from "../domain/types";
import { exchangeKindOf, exchangeProblem, exchangeTitle, type ExchangeKind } from "../domain/exchanges";

/** What adds an Exchange: its People, and its kind (a call), day (today) and body (none) unless said. */
export interface ExchangeInput {
  with: readonly string[];
  kind?: string;
  date?: string;
  body?: string;
}

/** What an edit of an Exchange may change through the App (the body is the Peek's, as any Document's). */
export interface ExchangePatch {
  kind?: ExchangeKind;
  date?: string;
  with?: readonly string[];
}

/** The ids of an Exchange's With, whatever a Base wrote. */
export const withOf = (x: Document): string[] => (Array.isArray(x.with) ? x.with.filter((id): id is string => typeof id === "string") : []);

/** The People's names, in With's order: read as stored, so a locked Private folder never drops one from a title; a deleted Person has none. */
async function namesOf(ids: readonly string[]): Promise<string[]> {
  const rows = await documentsTable().bulkGet([...ids]);
  return rows.flatMap((r) => (r && !r.deleted && r.title ? [r.title] : []));
}

/** The title an Exchange has as it stands: its kind and its People's names. */
const titleFor = async (x: Document) => exchangeTitle(x.kind, await namesOf(withOf(x)));

/** The People named, each once, in order; refused unless every one is a Person here. */
async function people(ids: readonly string[]): Promise<Document[]> {
  const out: Document[] = [];
  for (const id of new Set(ids)) {
    const p = await getDocument(id);
    if (p?.type !== PERSON_TYPE) throw new Error("Only People can be in an exchange's With.");
    out.push(p);
  }
  return out;
}

/** Log an Exchange (ADR 0131); throws in words for a day to come, nobody, or what is no Person. */
export async function addExchange(input: ExchangeInput): Promise<Exchange> {
  const date = input.date?.trim() || todayStr();
  const problem = exchangeProblem({ with: input.with, date }, todayStr());
  if (problem) throw new Error(problem);
  const found = await people(input.with);
  const kind = exchangeKindOf(input.kind);
  const title = exchangeTitle(kind, found.map((p) => p.title));
  return (await createDocument({ type: EXCHANGE_TYPE, title, folder: EXCHANGES_FOLDER, body: input.body ?? "", fields: { kind, date, with: found.map((p) => p.id) } })) as Exchange;
}

/** Change an Exchange's kind, day or People (its Peek); refused as an add would be. Its title follows. */
export async function editExchange(id: string, patch: ExchangePatch): Promise<void> {
  const x = await getDocument(id);
  if (!x || x.type !== EXCHANGE_TYPE) throw new Error("No such exchange");
  const next = { kind: exchangeKindOf(patch.kind ?? x.kind), date: patch.date ?? String(x.date ?? ""), with: patch.with ? [...patch.with] : withOf(x) };
  const problem = exchangeProblem(next, todayStr());
  if (problem) throw new Error(problem);
  if (patch.with) next.with = (await people(patch.with)).map((p) => p.id);
  const row = { ...x, ...next };
  await putDocument({ ...row, title: await titleFor(row) });
}

/**
 * Keeps an Exchange's stored title true (`afterSaveOf`, ADR 0121): run after an
 * Exchange is saved from anywhere (a Base, an agent) and after a Person is, so
 * a rename reaches every Exchange they are in. Writes only what changed.
 */
export async function keepExchangesTitled(saved: Document): Promise<void> {
  const rows = saved.type === EXCHANGE_TYPE ? [saved] : (await documentsOf(EXCHANGE_TYPE)).filter((x) => withOf(x).includes(saved.id));
  for (const x of rows) {
    const title = await titleFor(x);
    if (title !== x.title) await putDocument({ ...x, title });
  }
}

/**
 * A Person deleted leaves every Exchange they were in (the Person's `onDelete`):
 * the Exchange stays, titled from who is left, "· nobody" once no one is
 * (its body is still the user's). Core's `unlinkOnDelete` would drop the id
 * too, but keep the title it had.
 */
export async function dropFromExchanges(personId: string): Promise<void> {
  for (const x of await documentsOf(EXCHANGE_TYPE)) {
    const ids = withOf(x);
    if (!ids.includes(personId)) continue;
    const row = { ...x, with: ids.filter((id) => id !== personId) };
    await putDocument({ ...row, title: await titleFor(row) });
  }
}

/** Delete an Exchange, handing it back for Undo (`restoreExchange`). */
export async function removeExchange(id: string): Promise<Exchange> {
  const x = await getDocument<Exchange>(id);
  if (!x) throw new Error("It is already gone");
  await removeDocument(id);
  return x;
}

/** Undo `removeExchange`: the same Exchange, back on its People's Timelines. */
export async function restoreExchange(x: Exchange): Promise<void> {
  await putDocument<Exchange>({ ...x, deleted: 0 } as Exchange);
}

/** Every Exchange in the Workspace, live. */
export const useExchanges = () => useDocuments<Exchange>(EXCHANGE_TYPE);
