import { useMemo } from "react";
import { documentsWithRole, useLiveQuery, type Document } from "@lifeline/core";
import { familyOfDoc, type SourceItem } from "../domain/works";
import { SOURCE_ROLE } from "../domain/types";

/** The Library's Authors (ADR 0052): a book's byline is its Authors' names, read here like any other Document. */
const AUTHOR = "author";

function toItem(d: Document, names: ReadonlyMap<string, string>): SourceItem {
  const ids = Array.isArray(d.authors) ? (d.authors as string[]) : [];
  const byline = ids.map((id) => names.get(id) ?? "").filter(Boolean).join(", ");
  const own = typeof d.author === "string" ? d.author : "";
  return {
    ...d,
    creator: byline || (typeof d.creator === "string" ? d.creator : "") || own,
    coverUrl: typeof d.coverUrl === "string" ? d.coverUrl : "",
    family: familyOfDoc(d),
    url: typeof d.url === "string" ? d.url : undefined,
    parent: typeof d.parent === "string" ? d.parent : undefined,
  } as SourceItem;
}

async function read(): Promise<{ sources: Document[]; authors: Document[] }> {
  const [sources, authors] = await Promise.all([documentsWithRole<Document>(SOURCE_ROLE), documentsWithRole<Document>(AUTHOR)]);
  return { sources, authors };
}

/** Every Source, read once — what a headless Note or Quote names its Source against. */
export async function allSources(): Promise<SourceItem[]> {
  const { sources, authors } = await read();
  const names = new Map(authors.map((a) => [a.id, a.title]));
  return sources.map((d) => toItem(d, names));
}

/** Every Source — works, the App's own, and whatever wears the Role — with its byline resolved. */
export function useSources(): SourceItem[] {
  const rows = useLiveQuery(read, [], { sources: [] as Document[], authors: [] as Document[] });
  return useMemo(() => {
    const names = new Map(rows.authors.map((a) => [a.id, a.title]));
    return rows.sources.map((d) => toItem(d, names));
  }, [rows]);
}
