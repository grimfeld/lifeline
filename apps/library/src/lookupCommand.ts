import type { CommandDef } from "@lifeline/core";
import { Search } from "lucide-react";
import { WORK_TYPES, type WorkTypeId } from "./domain/workTypes";
import { allWorks, lookupSettings } from "./data/repo";
import { candidateOf, lookupHits } from "./data/lookupCandidates";

/** "Look up a book…" for Claude: what the lookup chain says about a book, comic or manga, an ISBN included (ADR 0108). It only reads. */
export const libraryLookupCommand: CommandDef = {
  id: "library.lookup",
  title: "Look up a book…",
  keywords: ["book", "comic", "manga", "isbn", "lookup", "find", "search", "library", "metadata"],
  icon: Search,
  args: [
    { key: "query", label: "Query", kind: "text", hint: "An ISBN (10 or 13 digits) or free text such as a title and author." },
    { key: "type", label: "Kind", kind: "select", options: WORK_TYPES.map((t) => ({ value: t.id, label: t.label })), hint: `Defaults to ${WORK_TYPES[0]!.id}.` },
    { key: "title", label: "Title", kind: "text", hint: "Narrows the search to a title, instead of or beside the query." },
    { key: "author", label: "Author", kind: "text", hint: "Narrows the search to an author." },
  ],
  async invoke(a) {
    const medium = ((a.type as WorkTypeId | undefined) ?? WORK_TYPES[0]!.id) as WorkTypeId;
    const text = (a.query as string | undefined)?.trim();
    const title = (a.title as string | undefined)?.trim();
    const author = (a.author as string | undefined)?.trim();
    if (!text && !title && !author) throw new Error("Give a query (an ISBN or free text), a title or an author to look up");
    let hits;
    try {
      hits = await lookupHits(medium, { ...(text ? { text } : {}), ...(title ? { title } : {}), ...(author ? { author } : {}) }, await lookupSettings());
    } catch (e) {
      return { message: `Lookup unavailable: ${(e as Error).message}. Nothing was found; try again later.` };
    }
    const works = await allWorks();
    const candidates = hits.map((h) => candidateOf(h, works, medium));
    return { message: JSON.stringify({ candidates, note: candidates.length ? "A candidate with onShelf is already on the shelf (id and Shelf); the rest can be added with their externalKey." : "No candidates." }) };
  },
};
