import type { Document } from "@lifeline/core";

/**
 * How a Document is read on its way to a Source (ADR 0073): whether it plays
 * the Source Role, and the Source its own Source-Role link names — a Note's or
 * a Quote's Source, a Source's parent. Given, so this stays pure.
 */
export interface SourceReading {
  get(id: string): Document | undefined;
  isSource(doc: Document): boolean;
  /** The id in the Document's Link field that takes a Source, "" for none. */
  linkedSource(doc: Document): string;
}

/**
 * Every Source a piece of kept material counts toward, nearest first: the
 * origin itself when it is a Source, else the Source it was taken from, then
 * each Source that one is part of. Read through the links every time, never
 * stored — a Note given another Source takes what was kept from it along.
 * A loop in the parents ends the walk rather than spinning.
 */
export function sourceChain(originId: string, read: SourceReading): string[] {
  const out: string[] = [];
  let doc = originId ? read.get(originId) : undefined;
  if (doc && !read.isSource(doc)) doc = read.get(read.linkedSource(doc));
  while (doc && read.isSource(doc) && !out.includes(doc.id)) {
    out.push(doc.id);
    doc = read.get(read.linkedSource(doc));
  }
  return out;
}
