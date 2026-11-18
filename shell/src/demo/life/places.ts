import { PLACE_TYPE } from "@lifeline/core";
import { allEvents, updateEvent } from "@lifeline/app-calendar/src/data/repo";
import { addPlace } from "@lifeline/app-atlas/src/data/repo";
import { PLACES } from "../persona";
import { idOf } from "./act";

/**
 * Atlas's Places (ADR 0128): the spots of the persona's life, with their
 * coordinates, so they stand on the World map. Her flat is no Place: a home
 * stays an Address on its Person. One she hasn't been to yet is To try.
 */
export async function seedPlaces(): Promise<void> {
  const { clinic, crag, market, park, myrtleville } = PLACES;
  const places = [
    { ...clinic, kind: "other" },
    { ...crag, kind: "venue" },
    { ...market, kind: "shop" },
    { ...park, kind: "park" },
    { ...myrtleville, kind: "other" },
  ];
  for (const p of places) await addPlace({ name: p.name, kind: p.kind, at: { lat: p.lat, lon: p.lng } });
  await addPlace({ name: "Good Day Deli", kind: "cafe", at: { lat: 51.8983, lon: -8.4711 }, toTry: true });
}

/** Last, once the Events and the Places are written: where the Events happen. */
export async function seedAt(): Promise<void> {
  const placeOf = (title: string): string | undefined =>
    title === `Sea swim at ${PLACES.myrtleville.name}` ? PLACES.myrtleville.name
    : title === "Running club 5k" ? PLACES.park.name
    : title.startsWith("Climbing with") ? PLACES.crag.name
    : undefined;
  for (const ev of await allEvents()) {
    const place = placeOf(ev.title);
    if (place) await updateEvent({ ...ev, at: await idOf(PLACE_TYPE, place) });
  }
}
