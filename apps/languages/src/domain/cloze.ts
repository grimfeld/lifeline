/**
 * A Sentence's text, read (CONTEXT.md "Sentence"): plain runs and blanks,
 * each blank written `{{like this}}`. A blank is known by its own text,
 * normalised — so adding, removing or reordering blanks leaves the others'
 * Recalls where they were (ADR 0058). The same text blanked twice gets `#2`.
 */
export type ClozePart = { kind: "text"; text: string } | { kind: "blank"; text: string; slot: string };

const BLANK = /\{\{(.*?)\}\}/g;

/** Case, accents kept (they are part of the word); spaces collapsed, ends trimmed. */
export function normalizeBlank(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  const seen = new Map<string, number>();
  let last = 0;
  for (const m of text.matchAll(BLANK)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: "text", text: text.slice(last, at) });
    const inner = m[1].trim();
    const norm = normalizeBlank(inner);
    if (norm) {
      const n = (seen.get(norm) ?? 0) + 1;
      seen.set(norm, n);
      parts.push({ kind: "blank", text: inner, slot: `blank:${norm}${n > 1 ? `#${n}` : ""}` });
    } else {
      parts.push({ kind: "text", text: m[0] });
    }
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

/** The Sentence as read aloud — blanks filled, markup gone. */
export function plainSentence(text: string): string {
  return parseCloze(text)
    .map((p) => p.text)
    .join("");
}

/** The blanks' slots, in reading order. */
export function blankSlots(text: string): string[] {
  return parseCloze(text).flatMap((p) => (p.kind === "blank" ? [p.slot] : []));
}
