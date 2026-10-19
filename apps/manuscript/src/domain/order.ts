import type { Chapter } from "./types";

/** Chapters in reading order: by position, then by when they were made. */
export function inOrder<T extends Pick<Chapter, "position" | "createdAt" | "id">>(chapters: readonly T[]): T[] {
  return [...chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** The position a new Chapter takes: after the last one. */
export function nextPosition(chapters: readonly Pick<Chapter, "position">[]): number {
  return chapters.reduce((m, c) => Math.max(m, c.position ?? 0), 0) + 1;
}

/**
 * Moving one Chapter up or down: the new positions of the Chapters that
 * change, renumbered 1…n so gaps and ties from other devices heal as a side
 * effect. Empty when the move goes past either end.
 */
export function moveChapter<T extends Pick<Chapter, "position" | "createdAt" | "id">>(chapters: readonly T[], id: string, by: -1 | 1): { id: string; position: number }[] {
  const order = inOrder(chapters);
  const at = order.findIndex((c) => c.id === id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= order.length) return [];
  [order[at], order[to]] = [order[to], order[at]];
  return order.flatMap((c, i) => (c.position === i + 1 ? [] : [{ id: c.id, position: i + 1 }]));
}

/** Remove a passage once from a body, tidying the blank lines it leaves. Undefined when the passage is not there. */
export function cutPassage(body: string, passage: string): string | undefined {
  const p = passage.trim();
  if (!p) return undefined;
  const at = body.indexOf(p);
  if (at < 0) return undefined;
  return (body.slice(0, at) + body.slice(at + p.length)).replace(/\n{3,}/g, "\n\n");
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** "Chapter N" for the next one, by how many there are. */
export function defaultChapterTitle(count: number): string {
  return `Chapter ${count + 1}`;
}
