import { createDocument, documentsOf } from "@lifeline/core";
import { SOURCE, SOURCES_FOLDER, type OwnSource, type SourceKind } from "../domain/types";
import { freeTitle } from "../domain/notes";

/**
 * Make one of the App's own Sources (ADR 0070): an article, a podcast, an
 * episode — by title alone if that is all there is, so a new Source never
 * costs more than its name while capturing.
 */
export async function addSource(input: { title: string; kind?: SourceKind | ""; url?: string; author?: string; publishedOn?: string; parent?: string; tags?: string[] }): Promise<OwnSource> {
  const wanted = input.title.replace(/\s+/g, " ").trim();
  if (!wanted) throw new Error("Name the Source");
  const taken = (await documentsOf<OwnSource>(SOURCE)).filter((s) => s.folder === SOURCES_FOLDER).map((s) => s.title);
  return (await createDocument({
    type: SOURCE,
    title: freeTitle(wanted, taken),
    folder: SOURCES_FOLDER,
    body: "",
    fields: {
      kind: input.kind ?? "",
      url: (input.url ?? "").trim(),
      author: (input.author ?? "").trim(),
      publishedOn: input.publishedOn ?? "",
      parent: input.parent ?? "",
      aliases: [],
      tags: input.tags ?? [],
    },
  })) as OwnSource;
}

/** A Source's name from a URL when nothing better is known: host and path, without the scheme. */
export function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return (u.hostname.replace(/^www\./, "") + (path && path !== "/" ? path : "")).slice(0, 80);
  } catch {
    return url.trim().slice(0, 80);
  }
}
