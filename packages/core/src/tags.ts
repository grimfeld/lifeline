/**
 * Tags (ADR 0014): a free-form, lower-cased word a user puts on a top-level
 * entity to group and filter across Apps. No Tag entity — the vocabulary is
 * derived from use (Taggable Contract). Every stored tag is a valid `#tag`
 * in a Note, so the same rules as the Notes parser apply here.
 */

/** A whole tag: letters/digits/_/-//, not a bare number. Mirrors Notes' TAG_RE. */
export const TAG_WORD_RE = /^\p{N}*[\p{L}_/-][\p{L}\p{N}_/-]*$/u;

/**
 * Normalise user input into a tag: trim, drop a leading `#`, lower-case,
 * spaces → `-`, collapse repeated separators, strip leading/trailing `/`.
 * Returns null when nothing valid remains.
 */
/** `t` less its leading and trailing `/` and `-`, by hand: `[/-]+$` is quadratic on a long run of them. */
export function trimSeparators(t: string): string {
  const sep = (c: string) => c === "/" || c === "-";
  let from = 0;
  let to = t.length;
  while (from < to && sep(t[from])) from++;
  while (to > from && sep(t[to - 1])) to--;
  return t.slice(from, to);
}

export function normalizeTag(raw: string): string | null {
  let t = raw.trim();
  if (t.startsWith("#")) t = t.slice(1);
  t = t.toLowerCase().replace(/\s+/g, "-").replace(/-{2,}/g, "-").replace(/\/{2,}/g, "/");
  t = trimSeparators(t);
  if (!t || !TAG_WORD_RE.test(t)) return null;
  return t;
}

/** Normalise many, dropping invalid ones and duplicates; order preserved. */
export function normalizeTags(raws: readonly string[] | undefined | null): string[] {
  const out: string[] = [];
  for (const r of raws ?? []) {
    const t = normalizeTag(r);
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

/** Split free text ("a, b #c") into tags. */
export function parseTagList(text: string): string[] {
  return normalizeTags(text.split(/[,\s]+/));
}

/**
 * A Tag filter is a conjunction of any-of sets: an item passes when, for
 * every non-empty set, it carries at least one of the set's tags. A Screen's
 * set and a Card's set compose this way (CONTEXT.md "Tag filter"). Empty
 * filter = everything passes; untagged items never pass a non-empty filter.
 */
export type TagFilter = readonly (readonly string[])[];

export const EMPTY_TAG_FILTER: TagFilter = [];

export function composeTagFilter(...sets: (readonly string[] | undefined | null)[]): TagFilter {
  return sets.filter((s): s is readonly string[] => !!s && s.length > 0);
}

export function isEmptyTagFilter(filter: TagFilter | undefined | null): boolean {
  return !filter || filter.every((s) => s.length === 0);
}

export function matchesTagFilter(tags: readonly string[] | undefined | null, filter: TagFilter | undefined | null): boolean {
  if (!filter) return true;
  for (const set of filter) {
    if (set.length === 0) continue;
    if (!tags || tags.length === 0) return false;
    if (!set.some((t) => tags.includes(t))) return false;
  }
  return true;
}

/** Every tag matched by the filter, flattened (for chips / labels). */
export function tagFilterLabel(filter: TagFilter | undefined | null): string {
  if (!filter) return "";
  return filter
    .filter((s) => s.length > 0)
    .map((s) => s.map((t) => `#${t}`).join(" | "))
    .join(" & ");
}
