import type { Thought, ThoughtKind } from "./types";

/**
 * A Thought's title when none is given: its first line of text, stripped of
 * heading marks, cut at a word near 80 characters — the stream shows bodies,
 * the title is what a wikilink names.
 */
export function titleFromText(text: string): string {
  const line =
    text
      .split("\n")
      .find((l) => l.trim())
      ?.replace(/^#+\s*/, "")
      // A wikilink reads as the name it shows: `[[Ursula Le Guin]]` → Ursula Le Guin, `[[Alex|my brother]]` → my brother.
      // A name and an alias hold no `[`, so a long run of `[[` is read once, not once per bracket.
      .replace(/!?\[\[([^[\]|]+)\|([^[\]]+)\]\]/g, "$2")
      .replace(/!?\[\[([^[\]]+)\]\]/g, "$1")
      .replace(/\s+/g, " ")
      .trim() ?? "";
  if (line.length <= 80) return line;
  const cut = line.slice(0, 80);
  const space = cut.lastIndexOf(" ");
  return (space > 40 ? cut.slice(0, space) : cut).replace(/[\s,.;:–—-]+$/, "") + "…";
}

/** A title not yet taken among `taken` (case-insensitive): the title, else "<title> (2)", "(3)"… */
export function freeTitle(title: string, taken: Iterable<string>): string {
  const lower = new Set([...taken].map((t) => t.toLowerCase()));
  if (!lower.has(title.toLowerCase())) return title;
  for (let n = 2; ; n++) {
    const next = `${title} (${n})`;
    if (!lower.has(next.toLowerCase())) return next;
  }
}

export interface StreamDay {
  /** "YYYY-MM-DD" the Thoughts were had (created). */
  date: string;
  thoughts: Thought[];
}

/**
 * The stream (ADR 0068): newest first, grouped by the day each Thought was
 * had, narrowed to one kind when asked. Never processed, never emptied — the
 * stream is a record, not an inbox.
 */
export function streamOf(thoughts: readonly Thought[], kind?: ThoughtKind): StreamDay[] {
  const kept = kind ? thoughts.filter((t) => t.kind === kind) : [...thoughts];
  // `updatedAt` breaks ties inside a day only as a stand-in for "later": a day keeps its newest first.
  kept.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
  const out: StreamDay[] = [];
  for (const t of kept) {
    const last = out[out.length - 1];
    if (last && last.date === t.createdAt) last.thoughts.push(t);
    else out.push({ date: t.createdAt, thoughts: [t] });
  }
  return out;
}
