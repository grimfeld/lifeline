import { useMemo } from "react";
import { documentsOf, getDocument, normalizeTags, patchDocument, putDocument, removeDocument, todayStr, useDocument, useDocuments, useLiveQuery } from "@lifeline/core";
import { ART_FORM_IDS, type ArtFormId } from "../domain/artForms";
import { ARTIST, EXHIBITION, ROOM, type Artist, type Artwork, type Exhibition, type Room } from "../domain/types";
import { addToRoom, canHang, canReopen, canTakeDown, hang, nextRoomOrder, reopen, takeDown, type Patch } from "../domain/rules";

/**
 * PocketBase stores absent text fields as "" and hands them back that way,
 * so every read re-establishes the domain's defaults.
 */
export function normalizeArtwork(a: Artwork): Artwork {
  return {
    ...a,
    artistId: a.artistId ?? "",
    year: a.year ?? "",
    imageUrl: a.imageUrl ?? "",
    location: a.location ?? "",
    materials: a.materials ?? "",
    dimensions: a.dimensions ?? "",
    seen: !!a.seen,
    externalKey: a.externalKey ?? "",
    addedOn: a.addedOn ?? "",
    tags: a.tags ?? [],
  };
}

function normalizeArtist(a: Artist): Artist {
  return { ...a, aliases: a.aliases ?? [], years: a.years ?? "", imageUrl: a.imageUrl ?? "", externalKey: a.externalKey ?? "", tags: a.tags ?? [] };
}

function normalizeExhibition(e: Exhibition): Exhibition {
  return { ...e, state: e.state || "PREP", hungOn: e.hungOn ?? "", archivedOn: e.archivedOn ?? "", tags: e.tags ?? [] };
}

function normalizeRoom(r: Room): Room {
  return { ...r, exhibitionId: r.exhibitionId ?? "", order: r.order || 0, artworkIds: Array.isArray(r.artworkIds) ? r.artworkIds : [], tags: r.tags ?? [] };
}

// --- artworks (the Holdings) ------------------------------------------------

/** Every Artwork and Artist, read once — what a headless add checks for a twin against. */
export async function allArtworks(): Promise<Artwork[]> {
  return (await Promise.all(ART_FORM_IDS.map((t) => documentsOf<Artwork>(t)))).flat().map(normalizeArtwork);
}

export async function allArtists(): Promise<Artist[]> {
  return (await documentsOf<Artist>(ARTIST)).map(normalizeArtist);
}

/** Every Artwork, across all five form types (one query per type, flattened). */
export function useArtworks(): Artwork[] {
  const rows = useLiveQuery(
    async () => (await Promise.all(ART_FORM_IDS.map((t) => documentsOf<Artwork>(t)))).flat(),
    [],
    [] as Artwork[],
  );
  return useMemo(() => rows.map(normalizeArtwork), [rows]);
}

export function useArtwork(id: string | undefined): Artwork | undefined {
  const row = useDocument<Artwork>(id);
  return useMemo(() => (row ? normalizeArtwork(row) : undefined), [row]);
}

export async function addArtwork(input: {
  form: ArtFormId;
  title: string;
  artistId?: string;
  year?: string;
  imageUrl?: string;
  location?: string;
  materials?: string;
  dimensions?: string;
  seen?: boolean;
  geo?: [number, number] | null;
  externalKey?: string;
  tags?: string[];
}): Promise<string> {
  const row = await putDocument<Artwork>({
    type: input.form,
    title: input.title.trim(),
    artistId: input.artistId ?? "",
    year: (input.year ?? "").trim(),
    imageUrl: (input.imageUrl ?? "").trim(),
    location: (input.location ?? "").trim(),
    materials: (input.materials ?? "").trim(),
    dimensions: (input.dimensions ?? "").trim(),
    seen: !!input.seen,
    geo: input.geo ?? null,
    externalKey: input.externalKey ?? "",
    addedOn: todayStr(),
    tags: normalizeTags(input.tags),
  });
  return row.id;
}

export async function patchArtwork(id: string, patch: Patch): Promise<void> {
  await patchDocument(id, patch);
}

/** Tombstone an Artwork and take it off every wall it hangs on. */
export async function deleteArtwork(id: string): Promise<void> {
  const rooms = await documentsOf<Room>(ROOM);
  for (const r of rooms) {
    const ids = Array.isArray(r.artworkIds) ? r.artworkIds : [];
    if (ids.includes(id)) await patchDocument(r.id, { artworkIds: ids.filter((x) => x !== id) });
  }
  await removeDocument(id);
}

// --- artists ----------------------------------------------------------------

export function useArtists(): Artist[] {
  const rows = useDocuments<Artist>(ARTIST);
  return useMemo(() => rows.map(normalizeArtist), [rows]);
}

/**
 * The Artist for a name (and optional Wikidata identity): found by external
 * key, then by name/alias (case-insensitive), else created — so lookups
 * never leave a manual chore and misspelled duplicates don't creep in.
 */
export async function ensureArtist(input: { name: string; externalKey?: string }): Promise<string> {
  const name = input.name.trim();
  if (!name) return "";
  const all = (await documentsOf<Artist>(ARTIST)).map(normalizeArtist);
  const key = input.externalKey ?? "";
  const byKey = key ? all.find((a) => a.externalKey === key) : undefined;
  if (byKey) return byKey.id;
  const lower = name.toLowerCase();
  const byName = all.find((a) => a.title.toLowerCase() === lower || a.aliases.some((al) => al.toLowerCase() === lower));
  if (byName) {
    if (key && !byName.externalKey) await patchDocument(byName.id, { externalKey: key });
    return byName.id;
  }
  const row = await putDocument<Artist>({ type: ARTIST, title: name, aliases: [], years: "", imageUrl: "", externalKey: key });
  return row.id;
}

// --- exhibitions and rooms ---------------------------------------------------

export function useExhibitions(): Exhibition[] {
  const rows = useDocuments<Exhibition>(EXHIBITION);
  return useMemo(() => rows.map(normalizeExhibition), [rows]);
}

export function useExhibition(id: string | undefined): Exhibition | undefined {
  const row = useDocument<Exhibition>(id);
  return useMemo(() => (row ? normalizeExhibition(row) : undefined), [row]);
}

export function useRooms(): Room[] {
  const rows = useDocuments<Room>(ROOM);
  return useMemo(() => rows.map(normalizeRoom), [rows]);
}

export async function addExhibition(title: string): Promise<string> {
  const row = await putDocument<Exhibition>({ type: EXHIBITION, title: title.trim(), state: "PREP", hungOn: "", archivedOn: "" });
  return row.id;
}

async function transition(id: string, guard: (s: Exhibition["state"]) => boolean, patch: Patch): Promise<boolean> {
  const e = await getDocument<Exhibition>(id);
  if (!e || !guard(normalizeExhibition(e).state)) return false;
  await patchDocument(id, patch);
  return true;
}

export const hangExhibition = (id: string) => transition(id, canHang, hang());
export const takeDownExhibition = (id: string) => transition(id, canTakeDown, takeDown());
export const reopenExhibition = (id: string) => transition(id, canReopen, reopen());

/** Tombstone an exhibition with its rooms. The artworks stay in the Holdings. */
export async function deleteExhibition(id: string): Promise<void> {
  const rooms = await documentsOf<Room>(ROOM);
  for (const r of rooms) if (r.exhibitionId === id) await removeDocument(r.id);
  await removeDocument(id);
}

export async function addRoom(exhibitionId: string, name: string): Promise<string> {
  const rooms = (await documentsOf<Room>(ROOM)).filter((r) => r.exhibitionId === exhibitionId);
  const row = await putDocument<Room>({ type: ROOM, title: name.trim() || "Room", exhibitionId, order: nextRoomOrder(rooms.map(normalizeRoom)), artworkIds: [] });
  return row.id;
}

export const renameRoom = (id: string, name: string) => patchDocument(id, { title: name.trim() || "Room" });
export const deleteRoom = (id: string) => removeDocument(id);
export const setRoomArtworks = (id: string, artworkIds: string[]) => patchDocument(id, { artworkIds });
export const hangInRoom = (room: Room, artworkId: string) => setRoomArtworks(room.id, addToRoom(room.artworkIds, artworkId));
export const setRoomOrder = (id: string, order: number) => patchDocument(id, { order });
