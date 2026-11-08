import { plainSentence } from "./cloze";

const fold = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The Sentences that use a Word (CONTEXT.md "Word"): those whose plain text
 * (blanks filled) holds its term as a whole word or phrase — case folded,
 * accents kept, no stemming. Derived on read; nothing is stored and nothing
 * is linked.
 */
export function sentencesUsing<S extends { text: string }>(term: string, sentences: S[]): S[] {
  const t = fold(term);
  if (!t) return [];
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escape(t)}(?![\\p{L}\\p{N}])`, "u");
  return sentences.filter((s) => re.test(fold(plainSentence(s.text))));
}
