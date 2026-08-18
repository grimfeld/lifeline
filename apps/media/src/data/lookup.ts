import type { MediaTypeId } from "../domain/mediaTypes";
import { mediaType } from "../domain/mediaTypes";
import { searchOpenLibrary, type WorkHit } from "./openlibrary";
import { searchMusicBrainz } from "./musicbrainz";

/** The lookup for a medium, if any (books/comics → Open Library, music → MusicBrainz). */
export function lookupFor(type: MediaTypeId): ((q: string, signal?: AbortSignal) => Promise<WorkHit[]>) | null {
  const src = mediaType(type).lookup;
  if (src === "openlibrary") return searchOpenLibrary;
  if (src === "musicbrainz") return searchMusicBrainz;
  return null;
}
