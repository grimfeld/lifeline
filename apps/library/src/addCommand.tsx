import { type CommandDef } from "@lifeline/core";
import { SlidersHorizontal } from "lucide-react";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { ACQUISITION, ENGAGEMENT, type Acquisition, type Engagement } from "./domain/types";
import { shelfLabel } from "./domain/cardQueries";
import { splitAuthorNames } from "./domain/authors";
import { addWork, allWorks, ensureAuthorNames, ensureAuthorRefs, findByExternalKey, lookupSettings } from "./data/repo";
import { resolveHit } from "./data/lookup";
import { fetchHitByKey, shelfTwinOf } from "./data/lookupCandidates";
import type { WorkHit } from "./data/openlibrary";

/** A source that hangs ends the add as unavailable, as it ends a lookup. */
const FETCH_TIMEOUT_MS = 15000;
const SOURCES = ["openlibrary", "googlebooks", "comicvine"];

const SHELVES: { value: Engagement; label: string }[] = [
  { value: "UNSTARTED", label: "To read" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "DONE", label: "Done" },
  { value: "ABANDONED", label: "Dropped" },
];
const ACQUISITIONS = ACQUISITION.map((a) => ({ value: a, label: a[0] + a.slice(1).toLowerCase() }));

/** A passed value wins over the source's; blank counts as not passed. */
const given = <T,>(passed: T | undefined, fromHit: T | undefined): T | undefined => (passed === undefined || passed === "" ? fromHit : passed);

/**
 * "Add book with details": a work with all its metadata and history, for the
 * dialog and for Claude. An external key (from `library.lookup`) fetches the
 * source's hit; every field passed overrides it. It never overwrites: a twin
 * is refused and named.
 */
export const libraryAddCommand: CommandDef = {
  id: "library.add",
  title: "Add book with details",
  keywords: ["book", "comic", "manga", "read", "details", "library"],
  icon: SlidersHorizontal,
  dialog: AddWorkDialog,
  args: [
    { key: "title", label: "Title", kind: "text", required: true, hint: "With an external key it replaces the source's title; pass the one from the lookup candidate." },
    { key: "type", label: "Kind", kind: "select", options: WORK_TYPES.map((t) => ({ value: t.id, label: t.label })), hint: `Defaults to ${WORK_TYPES[0]!.id}.` },
    { key: "externalKey", label: "External key", kind: "text", hint: "A candidate's externalKey from the lookup (openlibrary:…, googlebooks:…, comicvine:…): its fields are fetched, and what you pass wins. Leave out for a work no source knows." },
    { key: "authors", label: "Authors", kind: "text", hint: "Author(s), comma-separated; found or created. Replaces the source's authors." },
    { key: "year", label: "Year", kind: "number" },
    { key: "size", label: "Size", kind: "number", hint: "Pages for a book, issues for a comic, chapters for manga." },
    { key: "coverUrl", label: "Cover URL", kind: "text" },
    { key: "synopsis", label: "Synopsis", kind: "longtext" },
    { key: "series", label: "Series", kind: "text" },
    { key: "seriesNumber", label: "Number in series", kind: "number", hint: "1.5 is fine." },
    { key: "originalTitle", label: "Original title", kind: "text" },
    { key: "originalLanguage", label: "Original language", kind: "text", hint: "A name such as Japanese." },
    { key: "reason", label: "Reason", kind: "text", hint: "Who recommended it, or what made you want it." },
    { key: "acquisition", label: "Acquisition", kind: "select", options: ACQUISITIONS, hint: "Defaults to Wanted. Owned and Borrowed are acquired today." },
    { key: "shelf", label: "Shelf", kind: "select", options: SHELVES, hint: "Defaults to To read. In progress starts it today; Done finishes it. The Nightstand is never set here." },
    { key: "finishedOn", label: "Finished on", kind: "date", hint: "Only with the Done shelf; Done without it is finished today." },
    { key: "tags", label: "Tags", kind: "list" },
  ],
  returnsDocument: true,
  async invoke(a) {
    const medium = ((a.type as WorkTypeId | undefined) ?? WORK_TYPES[0]!.id) as WorkTypeId;
    const shelf = ((a.shelf as Engagement | undefined) ?? "UNSTARTED") as Engagement;
    const acquisition = ((a.acquisition as Acquisition | undefined) ?? "WANTED") as Acquisition;
    const finishedOn = a.finishedOn as string | undefined;
    if (!ENGAGEMENT.includes(shelf)) throw new Error("Shelf: To read, In progress, Done or Dropped");
    if (!ACQUISITION.includes(acquisition)) throw new Error("Acquisition: Wanted, Owned, Borrowed or Gone");
    if (finishedOn && shelf !== "DONE") throw new Error("Finished on: only with the Done shelf; nothing was added");

    const externalKey = ((a.externalKey as string | undefined) ?? "").trim();
    const works = await allWorks();
    const onShelf = (w: { title: string; type: string; engagement: Engagement }) => new Error(`“${w.title}” is already on the shelf (${shelfLabel(w.engagement, w.type as WorkTypeId)}); tell the user — nothing was changed`);

    let hit: WorkHit | undefined;
    if (externalKey) {
      if (!SOURCES.includes(externalKey.split(":")[0]!) || !externalKey.includes(":")) throw new Error(`External key “${externalKey}” names no source; use a candidate's externalKey from the lookup, or leave it out`);
      const dup = findByExternalKey(works, externalKey);
      if (dup) throw onShelf(dup);
      try {
        hit = await fetchHitByKey(externalKey, await lookupSettings(), AbortSignal.timeout(FETCH_TIMEOUT_MS));
      } catch (e) {
        throw new Error(`Source unavailable: ${(e as Error).message}; nothing was added, try again later`);
      }
      if (!hit) throw new Error(`The source has no work under “${externalKey}”; nothing was added`);
      hit = await resolveHit(hit);
    }

    const title = ((a.title as string | undefined) ?? "").trim() || hit?.title.trim() || "";
    if (!title) throw new Error("A title is required");
    const twin = shelfTwinOf(works, medium, { externalKey, title });
    if (twin) throw onShelf(twin);

    const names = (a.authors as string | undefined)?.trim();
    const authors = names ? await ensureAuthorNames(splitAuthorNames(names)) : hit ? await ensureAuthorRefs(hit.authors) : [];
    const id = await addWork({
      medium,
      title,
      authors,
      externalKey,
      coverUrl: given(a.coverUrl as string | undefined, hit?.coverUrl),
      year: given(a.year as number | undefined, hit?.year),
      size: given(a.size as number | undefined, hit?.size),
      synopsis: given(a.synopsis as string | undefined, hit?.synopsis),
      series: given(a.series as string | undefined, hit?.series),
      seriesNumber: given(a.seriesNumber as number | undefined, hit?.seriesNumber),
      originalTitle: given(a.originalTitle as string | undefined, hit?.originalTitle),
      originalLanguage: given(a.originalLanguage as string | undefined, hit?.originalLanguage),
      reason: (a.reason as string | undefined) ?? "",
      acquisition,
      engagement: shelf,
      finishedOn,
      tags: a.tags as string[] | undefined,
    });
    return { id, message: `${title} added (${workType(medium).engagement[shelf]}, ${acquisition.toLowerCase()})` };
  },
};
