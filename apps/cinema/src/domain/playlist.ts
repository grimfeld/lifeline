import type { Playlist, Work } from "./types";

/**
 * Playlists (CONTEXT.md, ADR 0035): a named, ordered selection of works I
 * curate by hand. Membership belongs to the Playlist — an ordered list of
 * work ids on it — never to the work, so these are pure list operations,
 * the Museum's Room rules copied.
 */

/** Append a work at the end (idempotent). */
export function addToPlaylist(ids: string[], workId: string): string[] {
  return ids.includes(workId) ? ids : [...ids, workId];
}

export function removeFromPlaylist(ids: string[], workId: string): string[] {
  return ids.filter((id) => id !== workId);
}

/** Move a work one step up/down. Out-of-range moves are no-ops. */
export function moveInPlaylist(ids: string[], workId: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(workId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, workId);
  return next;
}

/** The playlists a work sits in, in title order. */
export function playlistsWith(playlists: Playlist[], workId: string): Playlist[] {
  return playlists.filter((p) => p.workIds.includes(workId)).sort(byTitle);
}

/** The works of a playlist in its order; ids of works that no longer exist are skipped, never shown as holes. */
export function worksOf(playlist: Playlist, byId: Map<string, Work>): Work[] {
  return playlist.workIds.map((id) => byId.get(id)).filter((w): w is Work => w !== undefined);
}

export const byTitle = (a: Playlist, b: Playlist) => a.title.localeCompare(b.title);
