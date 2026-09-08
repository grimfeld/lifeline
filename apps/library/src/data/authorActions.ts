import { applyIdentity, confidentAuthorMatch, foldBibliography, isUnresolved, type AuthorHit, type BibliographyRow } from "../domain/authors";
import type { Author } from "../domain/types";
import { fetchOpenLibraryAuthor, fetchOpenLibraryAuthorWorks, olAuthorId, searchOpenLibraryAuthors } from "./openlibrary";
import { addWork, patchAuthor } from "./repo";
import type { WorkTypeId } from "../domain/workTypes";

/** Lookup-driven writes on Authors (ADR 0052): find candidates, resolve one, walk the unresolved, fetch a Bibliography. */

export function findAuthorCandidates(author: Pick<Author, "title">, signal?: AbortSignal): Promise<AuthorHit[]> {
  return searchOpenLibraryAuthors(author.title, signal);
}

/**
 * Give an Author its Open Library identity from a picked hit: key, years,
 * aliases from the hit, and the photo from the author record (one more
 * request; a failure there keeps the rest). Never renames.
 */
export async function resolveAuthor(author: Author, hit: AuthorHit, signal?: AbortSignal): Promise<void> {
  let photoUrl = "";
  let alternateNames = hit.alternateNames;
  let born = hit.born;
  let died = hit.died;
  try {
    const d = await fetchOpenLibraryAuthor(hit.externalKey, signal);
    photoUrl = d.photoUrl;
    alternateNames = [...alternateNames, ...d.alternateNames];
    born = born || d.born;
    died = died || d.died;
  } catch {
    /* the search hit is enough */
  }
  const patch = applyIdentity(author, { externalKey: hit.externalKey, alternateNames, born, died, photoUrl });
  if (Object.keys(patch).length) await patchAuthor(author.id, patch);
}

/** Re-pull years, photo and aliases for an Author that already has an identity. */
export async function refreshAuthor(author: Author, signal?: AbortSignal): Promise<boolean> {
  if (!olAuthorId(author.externalKey)) return false;
  const d = await fetchOpenLibraryAuthor(author.externalKey, signal);
  const patch = applyIdentity(author, d);
  if (Object.keys(patch).length) await patchAuthor(author.id, patch);
  return Object.keys(patch).length > 0;
}

export interface ResolveProgress {
  done: number;
  total: number;
  resolved: number;
  failed: number;
}
export interface ResolveResult extends ResolveProgress {
  /** Authors with candidates but no single exact-name hit — for a pick. */
  needsPick: { author: Author; hits: AuthorHit[] }[];
  /** Authors Open Library knows nothing about. */
  notFound: Author[];
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

/**
 * "Resolve authors" (ADR 0052): walk the unresolved Authors 300 ms apart,
 * apply only a single exact-name hit, and report the rest for a pick.
 */
export async function resolveAuthorsAll(authors: Author[], onProgress?: (p: ResolveProgress) => void, signal?: AbortSignal): Promise<ResolveResult> {
  const todo = authors.filter(isUnresolved);
  const res: ResolveResult = { done: 0, total: todo.length, resolved: 0, failed: 0, needsPick: [], notFound: [] };
  for (const author of todo) {
    if (signal?.aborted) break;
    try {
      const hits = await findAuthorCandidates(author, signal);
      const sure = confidentAuthorMatch(author.title, hits);
      if (sure) {
        await resolveAuthor(author, sure, signal);
        res.resolved++;
      } else if (hits.length) res.needsPick.push({ author, hits });
      else res.notFound.push(author);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") break;
      res.failed++;
    }
    res.done++;
    onProgress?.({ ...res });
    if (res.done < res.total) await sleep(300, signal);
  }
  return res;
}

/** The Bibliography (CONTEXT.md): fetched now, folded, never stored. */
export async function fetchBibliography(author: Pick<Author, "externalKey">, signal?: AbortSignal): Promise<BibliographyRow[]> {
  const rows = await fetchOpenLibraryAuthorWorks(author.externalKey, signal);
  return foldBibliography(rows, true);
}

/** Add ticked Bibliography rows as Works of the medium: To read, Wanted, no Reason (ADR 0052). Returns the new ids. */
export async function addFromBibliography(author: Author, rows: BibliographyRow[], medium: WorkTypeId): Promise<string[]> {
  const ids: string[] = [];
  for (const r of rows) {
    ids.push(await addWork({ medium, title: r.title, authors: [author.id], externalKey: r.externalKey, coverUrl: r.coverUrl, year: r.year, acquisition: "WANTED", reason: "" }));
  }
  return ids;
}
