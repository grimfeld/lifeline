import { useMemo } from "react";
import { type DocumentInput, documentsOf, documentsWithRole, getDocument, newId, normalizeTags, patchDocument, putDocument, removeDocument, removeDocumentsWhere, sharedLiveQuery, todayStr, useDocument, useLiveQuery } from "@lifeline/core";
import { AUTHOR, SETTINGS_TYPE, WORK_TYPE_IDS, type Acquisition, type Author, type Work, type LookupSettings } from "../domain/types";
import type { WorkTypeId } from "../domain/workTypes";
import type { Patch } from "../domain/rules";
import { answersTo, mergePlan, relinkAuthors, splitAuthorNames, type AuthorPatch } from "../domain/authors";
import type { AuthorRef } from "./openlibrary";

/**
 * PocketBase stores absent text/number fields as ""/0 and hands them back
 * that way, so every read re-establishes the domain's defaults.
 */
export function normalize(m: Work): Work {
  return {
    ...m,
    authors: Array.isArray(m.authors) ? m.authors.map(String).filter(Boolean) : [],
    externalKey: m.externalKey ?? "",
    coverUrl: m.coverUrl ?? "",
    size: m.size || 0,
    year: m.year || 0,
    reason: m.reason ?? "",
    slot: m.slot || 0,
    acquiredOn: m.acquiredOn ?? "",
    slottedOn: m.slottedOn ?? "",
    startedOn: m.startedOn ?? "",
    finishedOn: m.finishedOn ?? "",
    liked: !!m.liked,
    rating: m.rating || 0,
    partsTracked: !!m.partsTracked,
    caughtUpGroup: m.caughtUpGroup || 0,
    caughtUpPart: m.caughtUpPart || 0,
    partCount: m.partCount || 0,
    tags: m.tags ?? [],
  };
}

/** Every media item, across all six medium types (one query per type, flattened). */
export function useWorks(): Work[] {
  const rows = useLiveQuery(
    async () => (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<Work>(t)))).flat(),
    [],
    [] as Work[],
  );
  return useMemo(() => rows.map(normalize), [rows]);
}

/** Every work, read once — what headless Commands match titles against. */
export async function allWorks(): Promise<Work[]> {
  return (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<Work>(t)))).flat().map(normalize);
}

export async function addWork(input: {
  medium: WorkTypeId;
  title: string;
  /** Author ids (ADR 0052). */
  authors?: string[];
  externalKey?: string;
  coverUrl?: string;
  size?: number;
  year?: number;
  acquisition: Acquisition;
  reason: string;
  tags?: string[];
}): Promise<string> {
  const today = todayStr();
  const row = await putDocument<Work>({
    type: input.medium,
    title: input.title.trim(),
    authors: [...new Set((input.authors ?? []).filter(Boolean))],
    externalKey: input.externalKey ?? "",
    coverUrl: input.coverUrl ?? "",
    size: input.size || 0,
    year: input.year || 0,
    acquisition: input.acquisition,
    engagement: "UNSTARTED",
    reason: input.reason.trim(),
    slot: 0,
    addedOn: today,
    acquiredOn: input.acquisition === "OWNED" || input.acquisition === "BORROWED" ? today : "",
    slottedOn: "",
    startedOn: "",
    finishedOn: "",
    liked: false,
    rating: 0,
    partsTracked: false,
    caughtUpGroup: 0,
    caughtUpPart: 0,
    partCount: 0,
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

/** Apply a transition patch (or an edit) to an item. */
export async function patchWork(item: Work, patch: Patch): Promise<void> {
  // Only the patched fields, onto the stored row: writing the whole of a copy
  // read earlier reverts whatever changed since ("Enrich all" undoing a rating).
  await patchDocument(item.id, Array.isArray(patch.tags) ? { ...patch, tags: normalizeTags(patch.tags) } : patch);
}

/** The Notes App's Quote type (ADR 0070): a passage that cannot outlive its Source — here, the Work. */
const QUOTE = "quote";

/**
 * The Work types' cascade (ADR 0045), run by every delete — this App's,
 * the Vault's, a Base's: the Work's Quotes go with it.
 */
export async function cascadeWorkDelete(id: string): Promise<void> {
  await removeDocumentsWhere(QUOTE, (q) => (q as { source?: string }).source === id);
}

/** Delete a Work; its type's cascade takes its Quotes. */
export async function deleteWork(id: string): Promise<void> {
  await removeDocument(id);
}

/** Existing item with the same external identity, if any ("do I already own this?"). */
export function findByExternalKey(items: Work[], key: string): Work | undefined {
  return key ? items.find((m) => m.externalKey === key) : undefined;
}

/**
 * The Work a quick add would twin: the same outside identity, else the same
 * title in the same medium — unless both carry keys and they differ (two
 * films called "Dune" are two films).
 */
export function findTwin(items: Work[], input: { medium: WorkTypeId; title: string; externalKey?: string }): Work | undefined {
  const key = input.externalKey ?? "";
  const title = input.title.trim().toLowerCase();
  return findByExternalKey(items, key) ?? items.find((w) => w.type === input.medium && w.title.trim().toLowerCase() === title && (!key || !w.externalKey));
}

/**
 * Quick add (ADR 0006 amendment): title, optional author, medium — straight
 * onto the To… shelf, nothing else asked. Optional lookup hit attaches
 * cover/year/external key and its Authors; a typed author is found or
 * created by name (ADR 0052). Returns the new id (for Undo), or the twin it
 * found instead — then nothing was added.
 */
export async function quickAddWork(input: { medium: WorkTypeId; title: string; author?: string; hit?: { externalKey: string; coverUrl: string; year: number; size: number; authors: AuthorRef[] } }): Promise<{ id: string; twin?: Work }> {
  // Already yours: nothing is created (no Work, no Author) — the caller says so.
  const twin = findTwin(await allWorks(), { medium: input.medium, title: input.title, externalKey: input.hit?.externalKey });
  if (twin) return { id: twin.id, twin };
  const authors = input.hit?.authors.length ? await ensureAuthorRefs(input.hit.authors) : await ensureAuthorNames(splitAuthorNames(input.author ?? ""));
  const id = await addWork({
    medium: input.medium,
    title: input.title,
    authors,
    externalKey: input.hit?.externalKey ?? "",
    coverUrl: input.hit?.coverUrl ?? "",
    year: input.hit?.year ?? 0,
    size: input.hit?.size ?? 0,
    acquisition: "WANTED",
    reason: "",
  });
  return { id };
}

/** Parse "Title — Author" / "Title - Author" / "Title by Author" typed in a quick-add box. */
export function parseQuickTitle(raw: string): { title: string; author: string } {
  const t = raw.trim();
  const m = /^(.*?)\s+(?:—|–|-|by)\s+(.+)$/.exec(t);
  if (m && m[1].trim() && m[2].trim()) return { title: m[1].trim(), author: m[2].trim() };
  return { title: t, author: "" };
}

/* ---------- Authors (ADR 0052) ---------- */

export function normalizeAuthor(a: Author): Author {
  return {
    ...a,
    aliases: Array.isArray(a.aliases) ? a.aliases.map(String).filter(Boolean) : [],
    externalKey: a.externalKey ?? "",
    photoUrl: a.photoUrl ?? "",
    born: a.born ?? "",
    died: a.died ?? "",
    tags: a.tags ?? [],
  };
}

export async function allAuthors(): Promise<Author[]> {
  // Every Document playing the Author Role (ADR 0069): Authors, and whoever else wears it.
  return (await documentsWithRole<Author>(AUTHOR)).map(normalizeAuthor);
}

// One shared query: every byline on the Gallery reads the same array per change, not one live query per tile.
const authorsLive = sharedLiveQuery(() => allAuthors(), [] as Author[]);

export function useAuthors(): Author[] {
  return authorsLive.use();
}

export function useAuthor(id: string | undefined): Author | undefined {
  const row = useDocument<Author>(id);
  return useMemo(() => (row ? normalizeAuthor(row) : undefined), [row]);
}

/** Authors by id — what every byline resolves through. */
export function useAuthorIndex(): Map<string, Author> {
  const authors = useAuthors();
  return useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);
}

/**
 * The Author for a name (and optional Open Library identity): found by
 * external key, then by name or alias, else created — so a picked hit never
 * leaves a manual chore (ADR 0052). A keyed hit matches by name only an
 * Author with no key, which then takes the hit's. Returns the id, "" for a
 * blank name.
 */
export async function ensureAuthor(input: { name: string; externalKey?: string; aliases?: string[] }): Promise<string> {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) return "";
  const all = await allAuthors();
  const key = input.externalKey ?? "";
  const byKey = key ? all.find((a) => a.externalKey === key) : undefined;
  if (byKey) return byKey.id;
  // A name is no identity: a namesake with another key is someone else (two
  // John Williamses), so with a key in hand only a keyless namesake answers.
  const byName = all.find((a) => answersTo(a, name) && (!key || !a.externalKey));
  if (byName) {
    if (key && !byName.externalKey) await patchDocument(byName.id, { externalKey: key });
    return byName.id;
  }
  const row = await putDocument<Author>({ type: AUTHOR, title: name, aliases: input.aliases ?? [], externalKey: key, photoUrl: "", born: "", died: "" });
  return row.id;
}

/** ensureAuthor over a hit's authors, in order, deduped. */
export async function ensureAuthorRefs(refs: AuthorRef[]): Promise<string[]> {
  const out: string[] = [];
  for (const r of refs) {
    const id = await ensureAuthor({ name: r.name, externalKey: r.externalKey });
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/** ensureAuthor over typed names, in order, deduped. */
export const ensureAuthorNames = (names: string[]) => ensureAuthorRefs(names.map((name) => ({ name })));

export async function patchAuthor(id: string, patch: AuthorPatch): Promise<void> {
  await patchDocument(id, patch);
}

/** Every Work naming this Author. */
export async function worksBy(authorId: string): Promise<Work[]> {
  const rows = (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<Work>(t)))).flat().map(normalize);
  return rows.filter((w) => w.authors.includes(authorId));
}

/** Delete an Author: its Works are unlinked, never deleted (CONTEXT.md). Returns the ids it unlinked, for `restoreAuthor`. */
export async function deleteAuthor(id: string): Promise<string[]> {
  const unlinked: string[] = [];
  for (const w of await worksBy(id)) {
    await patchDocument(w.id, { authors: w.authors.filter((a) => a !== id) });
    unlinked.push(w.id);
  }
  await removeDocument(id);
  return unlinked;
}

/** Undo `deleteAuthor`: the Author comes back under its own id and takes back the Works it had (the Undo toast). */
export async function restoreAuthor(author: Author, workIds: string[]): Promise<void> {
  await putDocument<Author>(author as DocumentInput<Author>);
  for (const wid of workIds) {
    const w = await getDocument<Work>(wid);
    if (w && !w.authors.includes(author.id)) await patchDocument(wid, { authors: [...w.authors, author.id] });
  }
}

/**
 * Merge (CONTEXT.md "Author"): the survivor takes the loser's Works, names
 * as aliases, body and missing identity; the loser is deleted. Never crosses
 * a separation wall — both are read through the scope gate.
 */
export async function mergeAuthors(survivorId: string, loserId: string): Promise<void> {
  if (survivorId === loserId) return;
  const [survivor, loser] = await Promise.all([getDocument<Author>(survivorId), getDocument<Author>(loserId)]);
  if (!survivor || !loser) throw new Error("Author not found");
  const patch = mergePlan(normalizeAuthor(survivor), normalizeAuthor(loser));
  if (Object.keys(patch).length) await patchDocument(survivorId, patch);
  for (const w of await worksBy(loserId)) await patchDocument(w.id, { authors: relinkAuthors(w.authors, loserId, survivorId) });
  await removeDocument(loserId);
}

/* ---------- Lookup settings (one internal Document, found by type — ADR 0039) ---------- */

const EMPTY_SETTINGS: LookupSettings = {
  id: "", type: SETTINGS_TYPE, title: "Library lookup settings", tags: [], folder: "", createdAt: "",
  comicvineKey: "", googleBooksKey: "", updatedAt: "", deleted: 0,
};

function normalizeSettings(s: Partial<LookupSettings> | undefined): LookupSettings {
  return { ...EMPTY_SETTINGS, ...(s ?? {}), comicvineKey: s?.comicvineKey ?? "", googleBooksKey: s?.googleBooksKey ?? "" };
}

/** The one settings Document of this type, if saved. */
async function settingsRow(): Promise<LookupSettings | undefined> {
  return (await documentsOf<LookupSettings>(SETTINGS_TYPE))[0];
}

/**
 * One-time seed from the retired Media App's `media_settings` record
 * (ADR 0024): copy this App's keys the first time it finds none of its own.
 */
let seeded = false;
async function seedFromMediaSettings(): Promise<void> {
  if (seeded) return;
  seeded = true;
  if (await settingsRow()) return;
  const old = await getDocument<{ comicvineKey?: string; googleBooksKey?: string; type?: string } & LookupSettings>("default");
  const legacy = old?.type === "media_settings" ? old : undefined;
  if (!legacy?.comicvineKey && !legacy?.googleBooksKey) return;
  await putDocument<LookupSettings>({ ...EMPTY_SETTINGS, id: newId(), comicvineKey: legacy.comicvineKey ?? "", googleBooksKey: legacy.googleBooksKey ?? "" });
}

/** The lookup settings record (empty keys until saved). */
export function useLookupSettings(): LookupSettings {
  const row = useLiveQuery(async () => {
    await seedFromMediaSettings();
    return settingsRow();
  }, [], undefined as LookupSettings | undefined);
  // Stable identity between live-query results: effects depend on it.
  return useMemo(() => normalizeSettings(row), [row]);
}

export async function saveLookupSettings(patch: Partial<Omit<LookupSettings, "id" | "updatedAt" | "deleted">>): Promise<void> {
  const cur = normalizeSettings(await settingsRow());
  const trimmed = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
  await putDocument<LookupSettings>({ ...cur, ...trimmed, id: cur.id || newId(), type: SETTINGS_TYPE });
}
