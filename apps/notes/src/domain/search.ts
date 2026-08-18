import type { Note } from "./types";
import { excerpt, splitFrontmatter } from "./markdown";

/** Plain-ish version of a note body for snippets (no frontmatter/fences/markdown syntax; newlines kept as spaces). */
function plainText(body: string): string {
  return splitFrontmatter(body)
    .content.replace(/```[\s\S]*?```/g, " ")
    .replace(/!?\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a)
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** `radius` chars either side of [from, to) in `text`, with ellipses where cut. */
export function snippetAround(text: string, from: number, to: number, radius = 60): string {
  const start = Math.max(0, from - radius);
  const end = Math.min(text.length, to + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

/** Excerpt around the first `#tag` occurrence in the body (falls back to the plain excerpt). */
export function tagSnippet(body: string, tag: string, radius = 60): string {
  const text = plainText(body);
  const re = new RegExp(`(^|[^\\w#/])#${escapeRe(tag)}(?![\\w/-])`, "i");
  const m = re.exec(text);
  if (!m) return excerpt(body, radius * 2);
  const from = m.index + m[1].length;
  return snippetAround(text, from, from + tag.length + 1, radius);
}

export interface SearchHit {
  note: Note;
  /** Where the query matched: title/alias hits show the excerpt, body hits a snippet around the match. */
  snippet: string;
}

/**
 * Case-insensitive full-text over title, aliases (frontmatter) and body.
 * Ranking: title match, then alias, then body; ties by most recently updated.
 */
export function searchNotes(notes: Note[], query: string, aliasesOf: (n: Note) => string[] = () => []): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { note: Note; rank: number; snippet: string }[] = [];
  for (const note of notes) {
    if (note.title.toLowerCase().includes(q)) {
      hits.push({ note, rank: 0, snippet: excerpt(note.body, 120) });
      continue;
    }
    if (aliasesOf(note).some((a) => a.toLowerCase().includes(q))) {
      hits.push({ note, rank: 1, snippet: excerpt(note.body, 120) });
      continue;
    }
    const text = plainText(note.body);
    const i = text.toLowerCase().indexOf(q);
    if (i >= 0) hits.push({ note, rank: 2, snippet: snippetAround(text, i, i + q.length) });
  }
  return hits.sort((a, b) => a.rank - b.rank || b.note.updatedAt.localeCompare(a.note.updatedAt)).map(({ note, snippet }) => ({ note, snippet }));
}

/** A random element of `pool`, never `excludeId` when the pool has more than one entry. */
export function pickRandom<T extends { id: string }>(pool: T[], excludeId?: string, rnd: () => number = Math.random): T | undefined {
  if (pool.length === 0) return undefined;
  const candidates = pool.length > 1 && excludeId ? pool.filter((x) => x.id !== excludeId) : pool;
  return candidates[Math.floor(rnd() * candidates.length)];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
