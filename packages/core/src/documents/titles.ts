import { normalizeFolder } from "../folders";
import { normalizeName } from "../markdown";
import { documentTypeSync } from "./registry";
import { singularOf, type Document } from "./types";

/**
 * A title another Document of a type whose titles are unique in every folder
 * (`uniqueTitles`, a Place's, ADR 0119) already has. It names that Document,
 * and carries it, so a form can offer it and an agent can use its id.
 */
export class TitleTaken extends Error {
  constructor(
    readonly title: string,
    readonly existing: Document,
  ) {
    const def = documentTypeSync(existing.type);
    super(`“${title}” is already a ${def ? singularOf(def) : existing.type}: ${existing.title}`);
    this.name = "TitleTaken";
  }
}

/**
 * A taken title refused in words, to a caller that `sees` only some Documents
 * (an agent, ADR 0114): the Document that has it named with its id, so the
 * caller can use that one instead, unless the caller cannot see it. Then it is
 * named not at all; that the title is taken still shows (ADR 0119).
 */
export function titleTakenText(e: TitleTaken, sees: (doc: Document) => boolean = () => true): string {
  return sees(e.existing) ? `${e.message} (id ${e.existing.id})` : `“${e.title}” is already taken`;
}

/**
 * The live Document of `type` whose title `title` would clash with, but
 * `exceptId`: case and accents aside, in `folder` — or in any folder, for a
 * type whose titles are unique (`uniqueTitles`). None when the title is free.
 */
export function titleClash(docs: readonly Document[], type: string, folder: string, title: string, exceptId?: string): Document | undefined {
  const anywhere = !!documentTypeSync(type)?.uniqueTitles;
  const f = normalizeFolder(folder);
  const t = normalizeName(title);
  return docs.find((d) => d.type === type && d.id !== exceptId && !d.deleted && (anywhere || d.folder === f) && normalizeName(d.title) === t);
}

/**
 * Refuse a title taken among `docs` (`titleClash`): with `TitleTaken`, naming
 * the one that has it, for a type whose titles are unique in every folder;
 * else as a folder's clash ("… already exists in Ideas").
 */
export function assertTitleFree(docs: readonly Document[], type: string, folder: string, title: string, exceptId?: string): void {
  const clash = titleClash(docs, type, folder, title, exceptId);
  if (!clash) return;
  if (documentTypeSync(type)?.uniqueTitles) throw new TitleTaken(title, clash);
  const f = normalizeFolder(folder);
  throw new Error(`“${title}” already exists in ${f || "the root"}`);
}
