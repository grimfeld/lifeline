import type { Document } from "@lifeline/core";
import { isValidCoord } from "@lifeline/core";
import type { Address } from "./types";

/** A Person's Addresses as stored, keeping only well-formed entries (a row may predate the key, or hold anything). */
export function normalizeAddresses(raw: unknown): Address[] {
  if (!Array.isArray(raw)) return [];
  const out: Address[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const a = r as Record<string, unknown>;
    if (typeof a.id !== "string" || typeof a.text !== "string") continue;
    const at: Address = { id: a.id, label: typeof a.label === "string" ? a.label : "", text: a.text, former: a.former === true };
    if (isValidCoord(a.lat, a.lon)) {
      at.lat = a.lat as number;
      at.lon = a.lon as number;
    }
    out.push(at);
  }
  return out;
}

/** An Address's coordinates; null when its lookup found nothing (or never ran). */
export function coordsOf(a: Pick<Address, "lat" | "lon">): { lat: number; lon: number } | null {
  return a.lat !== undefined && a.lon !== undefined ? { lat: a.lat, lon: a.lon } : null;
}

/** A current Address whose lookup found no place: the page offers the lookup again. A former one is history, never looked up. */
export const isUnplaced = (a: Pick<Address, "lat" | "lon" | "former">) => !a.former && coordsOf(a) === null;

/**
 * The Pins of a Person (#418): one for each current Address with coordinates,
 * titled "Person · label". A former Address, or one whose lookup found
 * nothing, is not on the map.
 */
export function addressPinsOf(person: Document): { id: string; name: string; lat: number; lon: number }[] {
  return normalizeAddresses(person.addresses).flatMap((a) =>
    !a.former && a.lat !== undefined && a.lon !== undefined ? [{ id: a.id, name: `${person.title} · ${a.label}`, lat: a.lat, lon: a.lon }] : [],
  );
}

/** The Address dialog as it opens: blank, or the Address's label and text. */
export const addressDraft = (a: Pick<Address, "label" | "text"> | undefined) => ({ label: a ? a.label : "", text: a ? a.text : "" });

export interface AddressInput {
  label: string;
  text: string;
  lat?: number;
  lon?: number;
}

/** Add one to the end. Throws when there is no text; a blank label becomes "Address". */
export function addAddress(list: readonly Address[], input: AddressInput, newId: () => string): Address[] {
  const text = input.text.trim();
  if (!text) throw new Error("An Address needs its text");
  const at: Address = { id: newId(), label: input.label.trim() || "Address", text, former: false };
  if (isValidCoord(input.lat, input.lon)) {
    at.lat = input.lat;
    at.lon = input.lon;
  }
  return [...list, at];
}

/**
 * Change one. New text without new coordinates drops the old coordinates: they
 * were found for the words that are gone.
 */
export function editAddress(list: readonly Address[], id: string, patch: Partial<Omit<Address, "id">>): Address[] {
  return list.map((a) => {
    if (a.id !== id) return a;
    const next: Address = { ...a, ...patch };
    if (patch.text !== undefined) {
      next.text = patch.text.trim();
      if (!next.text) throw new Error("An Address needs its text");
      if (next.text !== a.text && !("lat" in patch)) {
        delete next.lat;
        delete next.lon;
      }
    }
    if (patch.label !== undefined) next.label = patch.label.trim() || "Address";
    return next;
  });
}

/** Current Addresses first, then former ones, each in the order added. */
export const sortedAddresses = (list: readonly Address[]): Address[] => [...list.filter((a) => !a.former), ...list.filter((a) => a.former)];
