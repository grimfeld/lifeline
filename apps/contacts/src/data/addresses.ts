import { geocode, type GeocodeHit } from "@lifeline/core";
import { addAddress, coordsOf, editAddress } from "../domain/addresses";
import type { Address } from "../domain/types";
import { updateAddresses } from "./repo";

type Coords = { lat: number; lon: number };

/** How a place is looked up: the text to its coordinates, or none (Core's geocode by default). */
export type Lookup = (text: string) => Promise<Coords | null>;

/** Look the text up: the first hit's coordinates, or none when nothing is found or the lookup fails. */
export async function locate(text: string, find: (query: string, limit: number) => Promise<GeocodeHit[]> = geocode): Promise<Coords | null> {
  try {
    const hit = (await find(text, 1))[0];
    return hit ? { lat: hit.lat, lon: hit.lon } : null;
  } catch {
    return null;
  }
}

/**
 * Save the Address dialog (#418): add one, or change `address`. The lookup
 * runs here, on save and nowhere else; unchanged text keeps the coordinates it
 * already has, found or not found. When the lookup finds nothing or fails, the
 * Address is saved all the same, with no coordinates. Answers whether it has
 * a place now.
 */
export async function saveAddress(personId: string, address: Address | undefined, input: { label: string; text: string }, lookup: Lookup = locate): Promise<boolean> {
  if (!input.text.trim()) throw new Error("An Address needs its text.");
  const found = address && address.text === input.text.trim() ? coordsOf(address) : await lookup(input.text);
  if (address) await updateAddresses(personId, (list) => editAddress(list, address.id, { label: input.label, text: input.text, lat: found?.lat, lon: found?.lon }));
  else await updateAddresses(personId, (list) => addAddress(list, { ...input, ...found }, () => crypto.randomUUID()));
  return found !== null;
}

/** The lookup again, from an explicit click on an Address with no place: answers whether one was found (and written). */
export async function relocateAddress(personId: string, address: Address, lookup: Lookup = locate): Promise<boolean> {
  const found = await lookup(address.text);
  if (!found) return false;
  await updateAddresses(personId, (list) => editAddress(list, address.id, found));
  return true;
}
