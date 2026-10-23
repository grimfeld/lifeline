import type { Author, Work } from "./types";

/**
 * Authors (CONTEXT.md, ADR 0052): the pure rules — how a typed creator string
 * splits into names, how names compare, how a Bibliography folds, what a
 * Merge does. Nothing here touches the store or the network.
 */

/** Case/diacritic/punctuation-insensitive key for comparing names ("Le Guin, Ursula K." ≈ "le guin ursula k"). */
export function normalizeAuthorName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const sameAuthorName = (a: string, b: string) => normalizeAuthorName(a) === normalizeAuthorName(b) && normalizeAuthorName(a) !== "";

/**
 * Split a creator string as people typed them — "Alan Moore / Dave Gibbons",
 * "A & B", "A, B and C" — into distinct names (ADR 0052's migration rule).
 * A comma is a separator, so "Le Guin, Ursula K." splits too; that is the
 * accepted cost, fixed by Merge.
 */
export function splitAuthorNames(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/\s*(?:\/|&|;|,|\band\b|\bet\b)\s*/i)) {
    const name = part.replace(/\s+/g, " ").trim();
    const key = normalizeAuthorName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

/** The names of a Work's Authors, in the Work's order; ids nothing resolves are skipped. */
export function authorNamesOf(work: Pick<Work, "authors">, byId: Map<string, Author>): string[] {
  return (work.authors ?? []).map((id) => byId.get(id)?.title ?? "").filter(Boolean);
}

/** "Frank Herbert, Brian Herbert" — the byline. */
export const byline = (names: string[]) => names.join(", ");

/** An Author with no outside identity yet: the ones "Resolve authors" walks. */
export const isUnresolved = (a: Pick<Author, "externalKey">) => !a.externalKey;

/** Does this Author answer to the name (title or any alias)? */
export function answersTo(a: Pick<Author, "title" | "aliases">, name: string): boolean {
  return sameAuthorName(a.title, name) || (a.aliases ?? []).some((al) => sameAuthorName(al, name));
}

/** An Open Library author search hit, as much as the picker and the confident match need. */
export interface AuthorHit {
  /** "openlibrary:/authors/OL…A". */
  externalKey: string;
  name: string;
  alternateNames: string[];
  born: string;
  died: string;
  topWork: string;
  workCount: number;
}

/**
 * The one hit whose name (or an alternate name) is exactly the Author's —
 * null if none or several. Strict on purpose: "John Williams" is skipped,
 * never guessed (ADR 0052).
 */
export function confidentAuthorMatch(name: string, hits: AuthorHit[]): AuthorHit | null {
  const key = normalizeAuthorName(name);
  if (!key) return null;
  const exact = hits.filter((h) => normalizeAuthorName(h.name) === key || h.alternateNames.some((a) => normalizeAuthorName(a) === key));
  return exact.length === 1 ? exact[0]! : null;
}

/** Aliases worth keeping from a resolved identity: every alternate name that is not the title itself, deduped. */
export function mergeAliases(title: string, ...lists: string[][]): string[] {
  const out: string[] = [];
  const seen = new Set([normalizeAuthorName(title)]);
  for (const list of lists) {
    for (const raw of list) {
      const name = raw.replace(/\s+/g, " ").trim();
      const key = normalizeAuthorName(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

export type AuthorPatch = Partial<Pick<Author, "title" | "aliases" | "externalKey" | "photoUrl" | "born" | "died" | "body">>;

/** What a resolved identity fills on an Author: key, years, photo and aliases — never the name (ADR 0052). Empty values leave fields alone. */
export function applyIdentity(a: Author, id: { externalKey: string; alternateNames: string[]; born: string; died: string; photoUrl?: string }): AuthorPatch {
  const patch: AuthorPatch = {};
  if (id.externalKey && id.externalKey !== a.externalKey) patch.externalKey = id.externalKey;
  if (id.born && id.born !== a.born) patch.born = id.born;
  if (id.died && id.died !== a.died) patch.died = id.died;
  if (id.photoUrl && id.photoUrl !== a.photoUrl) patch.photoUrl = id.photoUrl;
  const aliases = mergeAliases(a.title, a.aliases ?? [], id.alternateNames);
  if (aliases.length !== (a.aliases ?? []).length) patch.aliases = aliases;
  return patch;
}

/**
 * Merge (CONTEXT.md "Author"): what the survivor takes from the loser — its
 * name and aliases as aliases, its body under a divider, and its identity,
 * photo and years only where the survivor has none. The loser's Works are
 * relinked by the caller; the loser is then gone.
 */
export function mergePlan(survivor: Author, loser: Author): AuthorPatch {
  const patch: AuthorPatch = {};
  const aliases = mergeAliases(survivor.title, survivor.aliases ?? [], [loser.title, ...(loser.aliases ?? [])]);
  if (aliases.length !== (survivor.aliases ?? []).length) patch.aliases = aliases;
  const loserBody = (loser.body ?? "").trim();
  if (loserBody) {
    const own = (survivor.body ?? "").trim();
    patch.body = own ? `${own}\n\n---\n\n${loserBody}\n` : `${loserBody}\n`;
  }
  if (!survivor.externalKey && loser.externalKey) patch.externalKey = loser.externalKey;
  if (!survivor.photoUrl && loser.photoUrl) patch.photoUrl = loser.photoUrl;
  if (!survivor.born && loser.born) patch.born = loser.born;
  if (!survivor.died && loser.died) patch.died = loser.died;
  return patch;
}

/** Relink one Work from the loser to the survivor, keeping order and never listing the survivor twice. */
export function relinkAuthors(authors: string[], loserId: string, survivorId: string): string[] {
  if (!authors.includes(loserId)) return authors;
  const out: string[] = [];
  for (const id of authors) {
    const next = id === loserId ? survivorId : id;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

/** One row of a Bibliography (CONTEXT.md): what Open Library says the Author wrote — never stored. */
export interface BibliographyRow {
  /** "openlibrary:/works/OL…W" — the same key a lookup hit carries, so "already yours" is an equality. */
  externalKey: string;
  title: string;
  year: number;
  coverUrl: string;
}

/** Title key for folding: normalised, and with a trailing "(…)" or ": subtitle" left in — only true duplicates fold. */
const titleKey = (t: string) => normalizeAuthorName(t);

/**
 * Fold a Bibliography (ADR 0052): same-title rows collapse into one — the
 * one with a cover, then a year, wins — and year-less rows sink; newest
 * first above them. `showAll` keeps every row and only sorts.
 */
export function foldBibliography(rows: BibliographyRow[], showAll = false): BibliographyRow[] {
  let kept = rows;
  if (!showAll) {
    const best = new Map<string, BibliographyRow>();
    const order: string[] = [];
    const score = (r: BibliographyRow) => (r.coverUrl ? 2 : 0) + (r.year ? 1 : 0);
    for (const r of rows) {
      const k = titleKey(r.title);
      if (!k) continue;
      const cur = best.get(k);
      if (!cur) {
        best.set(k, r);
        order.push(k);
      } else if (score(r) > score(cur)) best.set(k, r);
    }
    kept = order.map((k) => best.get(k)!);
  }
  return [...kept].sort((a, b) => Number(!!b.year) - Number(!!a.year) || b.year - a.year || a.title.localeCompare(b.title));
}

/**
 * My Works by external key — what "already yours" looks a Bibliography row up
 * in, built once per shelf rather than scanning every Work for every row. The
 * first Work with a key wins; keyless Works are left out.
 */
export function ownedByKey(works: Work[]): Map<string, Work> {
  const out = new Map<string, Work>();
  for (const w of works) if (w.externalKey && !out.has(w.externalKey)) out.set(w.externalKey, w);
  return out;
}
