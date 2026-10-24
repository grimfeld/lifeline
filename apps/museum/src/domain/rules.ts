import { todayStr } from "@lifeline/core";
import type { Artwork, Exhibition, ExhibitionState, Room } from "./types";

/** A partial change to a Document. Transitions return patches, never whole records. */
export type Patch = Record<string, unknown>;

// --- exhibition lifecycle (ADR 0022) ---------------------------------------
// PREP → HANGING → ARCHIVED; hang and take down are the only verbs, taking
// down always archives, re-hanging an archived show is allowed, and reworking
// one means reopening it (back to PREP) first.

export const canHang = (s: ExhibitionState) => s === "PREP" || s === "ARCHIVED";
export const canTakeDown = (s: ExhibitionState) => s === "HANGING";
export const canReopen = (s: ExhibitionState) => s === "ARCHIVED";

export const hang = (today = todayStr()): Patch => ({ state: "HANGING", hungOn: today, archivedOn: "" });
export const takeDown = (today = todayStr()): Patch => ({ state: "ARCHIVED", archivedOn: today });
export const reopen = (): Patch => ({ state: "PREP", hungOn: "", archivedOn: "" });

export const STATE_LABELS: Record<ExhibitionState, string> = { PREP: "In preparation", HANGING: "Hanging", ARCHIVED: "Archived" };

export const hanging = (shows: Exhibition[]) => shows.filter((e) => e.state === "HANGING");

// --- rooms ------------------------------------------------------------------

/** The rooms of one exhibition, in walk order. */
export function roomsOf(rooms: Room[], exhibitionId: string): Room[] {
  return rooms.filter((r) => r.exhibitionId === exhibitionId).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export const nextRoomOrder = (rooms: Room[]) => rooms.reduce((m, r) => Math.max(m, r.order), 0) + 1;

/** Hang an artwork at the end of a room (idempotent). */
export function addToRoom(ids: string[], artworkId: string): string[] {
  return ids.includes(artworkId) ? ids : [...ids, artworkId];
}

export function removeFromRoom(ids: string[], artworkId: string): string[] {
  return ids.filter((id) => id !== artworkId);
}

/** Move an artwork one step left/right on the wall. Out-of-range moves are no-ops. */
export function moveInRoom(ids: string[], artworkId: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(artworkId);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, artworkId);
  return next;
}

/** Swap two rooms' walk positions (for reordering rooms). */
export function swapOrders(a: Room, b: Room): [Patch, Patch] {
  return [{ order: b.order }, { order: a.order }];
}

// --- On display (the rotating Card) ----------------------------------------

/**
 * Everything hung in the given exhibitions, deduplicated, with its show and
 * room, in a stable order (exhibition, room, wall position).
 */
export interface Hung {
  artwork: Artwork;
  exhibition: Exhibition;
  room: Room;
}

export function hungArtworks(shows: Exhibition[], rooms: Room[], artworks: Artwork[]): Hung[] {
  const byId = new Map(artworks.map((a) => [a.id, a]));
  const seen = new Set<string>();
  const out: Hung[] = [];
  for (const e of shows) {
    for (const r of roomsOf(rooms, e.id)) {
      for (const id of r.artworkIds) {
        const artwork = byId.get(id);
        if (!artwork || seen.has(id)) continue;
        seen.add(id);
        out.push({ artwork, exhibition: e, room: r });
      }
    }
  }
  return out;
}

/**
 * The day's pick from a pool: deterministic for a given (seed, pool) — the
 * same artwork all day on every device, another one tomorrow (FNV-1a over
 * the seed plus the pool's ids).
 */
export function dailyPick<T extends { artwork: { id: string } }>(pool: T[], seed: string): T | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => a.artwork.id.localeCompare(b.artwork.id));
  let h = 0x811c9dc5;
  for (const ch of `${seed}:${sorted.map((p) => p.artwork.id).join(",")}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return sorted[h % sorted.length] ?? null;
}
