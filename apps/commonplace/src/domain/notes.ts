/**
 * A Note's title when none is given: its first line of text, stripped of
 * heading marks and wikilink brackets, cut at a word near 80 characters.
 */
export function noteTitleFrom(text: string): string {
  const line =
    text
      .split("\n")
      .find((l) => l.trim())
      ?.replace(/^#+\s*/, "")
      .replace(/^>\s*/, "")
      .replace(/!?\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/!?\[\[([^\]]+)\]\]/g, "$1")
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

/** The day each Source was last taken from — what "the Sources I'm in now" sorts by after works in progress. */
export function lastUsedBySource(items: readonly { source: string; createdAt: string; capturedOn?: string }[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const it of items) {
    if (!it.source) continue;
    const day = it.capturedOn || it.createdAt;
    const prev = out.get(it.source);
    if (!prev || day > prev) out.set(it.source, day);
  }
  return out;
}
