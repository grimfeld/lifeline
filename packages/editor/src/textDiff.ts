/**
 * The smallest single replacement turning `prev` into `next`: the common
 * prefix and suffix are kept. Applying an external value as one whole-document
 * replacement would throw the caret to the end and re-render every widget;
 * this keeps an edit that happened elsewhere in the text away from where the
 * user is standing.
 */
export function textChange(prev: string, next: string): { from: number; to: number; insert: string } | null {
  if (prev === next) return null;
  const max = Math.min(prev.length, next.length);
  let start = 0;
  while (start < max && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  return { from: start, to: endPrev, insert: next.slice(start, endNext) };
}
