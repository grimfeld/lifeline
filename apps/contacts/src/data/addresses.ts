import { geocode, type GeocodeHit } from "@lifeline/core";
import { addAddress, coordsOf, editAddress } from "../domain/addresses";
import type { Address } from "../domain/types";
import { updateAddresses } from "./repo";

type Coords = { lat: number; lon: number };

/**
 * What a lookup came to: a place, no place for these words, or no answer at
 * all (offline, or the geocoder refused or failed: `reason` says how). The
 * last two are told apart, so the page never blames the text for an outage.
 */
export type Located = { kind: "found"; at: Coords } | { kind: "none" } | { kind: "failed"; reason: string };

/** How a place is looked up: the text to what was found (Core's geocode by default). */
export type Lookup = (text: string) => Promise<Located>;

/**
 * Look the text up: the first hit's coordinates, none when there is no hit,
 * or failed when the lookup itself fails. A failure is logged with its reason,
 * never the text: an Address stays on the device and with the geocoder.
 */
export async function locate(text: string, find: (query: string, limit: number) => Promise<GeocodeHit[]> = geocode): Promise<Located> {
  try {
    const hit = (await find(text, 1))[0];
    return hit ? { kind: "found", at: { lat: hit.lat, lon: hit.lon } } : { kind: "none" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[contacts] address lookup failed", { reason });
    return { kind: "failed", reason };
  }
}

/** Where a saved Address stands: on the map, off it because nothing was found, or off it because the lookup failed. */
export type Placed = Located["kind"];

/**
 * Save the Address dialog (#418): add one, or change `address`. The lookup
 * runs here, on save and nowhere else; unchanged text keeps the coordinates it
 * already has, found or not found. When the lookup finds nothing or fails, the
 * Address is saved all the same, with no coordinates. Answers where it stands.
 */
export async function saveAddress(personId: string, address: Address | undefined, input: { label: string; text: string }, lookup: Lookup = locate): Promise<Placed> {
  if (!input.text.trim()) throw new Error("An Address needs its text.");
  const kept = address && address.text === input.text.trim() ? coordsOf(address) : undefined;
  const located: Located = address && kept !== undefined ? (kept ? { kind: "found", at: kept } : { kind: "none" }) : await lookup(input.text);
  const found = located.kind === "found" ? located.at : undefined;
  if (address) await updateAddresses(personId, (list) => editAddress(list, address.id, { label: input.label, text: input.text, lat: found?.lat, lon: found?.lon }));
  else await updateAddresses(personId, (list) => addAddress(list, { ...input, ...found }, () => crypto.randomUUID()));
  return located.kind;
}

/** The lookup again, from an explicit click on an Address with no place: writes the place when one is found, and answers where it stands. */
export async function relocateAddress(personId: string, address: Address, lookup: Lookup = locate): Promise<Placed> {
  const located = await lookup(address.text);
  if (located.kind === "found") await updateAddresses(personId, (list) => editAddress(list, address.id, located.at));
  return located.kind;
}
