import { addDays, type DateStr } from "@lifeline/core";

/**
 * The persona sheet of the Demo's made-up life (CONTEXT.md "Demo", ADR 0077):
 * the single source of who the person is, where they live, the money they
 * count in, and the people and places their life touches. Every slice of the
 * Demo life (`./life/*`) takes its names from here, so the person reads the
 * same in the Agenda, the Journal, the Ledger and the Map.
 *
 * Fictional throughout: the venues are invented, the people are no one.
 * The life is dated by offsets from the visit day, never fixed dates — use
 * the helpers at the bottom.
 */
export const PERSONA = {
  name: "Iris Calloway",
  firstName: "Iris",
  age: 36,
  occupation: "Physiotherapist at a sports clinic",
  city: "Cork",
  country: "Ireland",
  /** Ledger, Prices and Swear Jar count in euros, so the person lives in the euro area. */
  currency: "EUR",
  /** Her own language: everything in the Demo life is written in English. */
  language: "en",
  summary:
    "Iris treats runners and rugby players at a clinic near the river, climbs twice a week, " +
    "swims in the sea on Saturdays, and is slowly learning Portuguese for a summer in Lisbon.",
} as const;

export interface Person {
  /** The name as it appears in titles and wikilinks. */
  name: string;
  /** Who they are to Iris, in a few words. */
  role: string;
  note: string;
}

/** The people in Iris's life. Keys are stable; use `PEOPLE.aoife.name` in content. */
export const PEOPLE = {
  helen: {
    name: "Helen Calloway",
    role: "Mum",
    note: "Retired music teacher in Kilkenny; rings on Sunday evenings and gardens with ambition.",
  },
  aoife: {
    name: "Aoife Brennan",
    role: "Best friend",
    note: "Friends since college; a radio producer who plans every weekend away.",
  },
  marcus: {
    name: "Marcus Adeyemi",
    role: "Climbing partner",
    note: "A ferry engineer who belays with infinite patience and never warms up.",
  },
  priya: {
    name: "Priya Nair",
    role: "Neighbour",
    note: "Lives across the landing with two cats; trades tools for baking.",
  },
  sam: {
    name: "Sam Whelan",
    role: "Clinic lead",
    note: "Runs Harbourside Physio; fond of spreadsheets and early meetings.",
  },
  luis: {
    name: "Luís Duarte",
    role: "Portuguese tutor",
    note: "Teaches online from Porto on Tuesday evenings; corrects her gender agreements gently.",
  },
} as const satisfies Record<string, Person>;

export type PersonKey = keyof typeof PEOPLE;

export interface Place {
  name: string;
  /** What kind of place it is, in a word or two. */
  kind: string;
  note: string;
  /** Roughly where it is, for Locatable content (the Map). */
  lat: number;
  lng: number;
}

/** The places Iris's life happens in. */
export const PLACES = {
  home: {
    name: "Ballintemple flat",
    kind: "Home",
    note: "Second-floor flat with a balcony of herbs and a view of the rooftops.",
    lat: 51.8949,
    lng: -8.4302,
  },
  clinic: {
    name: "Harbourside Physio",
    kind: "Work",
    note: "The sports clinic by the river where Iris works four days a week.",
    lat: 51.9003,
    lng: -8.4612,
  },
  crag: {
    name: "The Crag",
    kind: "Climbing gym",
    note: "Bouldering and top-rope walls in an old warehouse; Tuesday and Thursday nights.",
    lat: 51.8986,
    lng: -8.4891,
  },
  market: {
    name: "English Market",
    kind: "Market",
    note: "The covered market for fish, cheese and Saturday coffee.",
    lat: 51.8977,
    lng: -8.4747,
  },
  park: {
    name: "Marina Park",
    kind: "Park",
    note: "Her running loop along the river, flat and windy.",
    lat: 51.8995,
    lng: -8.4282,
  },
  myrtleville: {
    name: "Myrtleville Beach",
    kind: "Beach",
    note: "The sea-swimming spot, cold all year, with a flask of tea after.",
    lat: 51.7838,
    lng: -8.2982,
  },
} as const satisfies Record<string, Place>;

export type PlaceKey = keyof typeof PLACES;

/**
 * Dates around the visit day. Content says "three days ago at 18:00", never a
 * calendar date, so the life follows whoever opens it, whenever.
 */
export interface LifeClock {
  /** The visit day itself. */
  today: DateStr;
  /** The day `offset` days from the visit day (negative = before). */
  day(offset: number): DateStr;
  /**
   * A logged moment, as an ISO string: `offset` days from the visit day at
   * `time` ("HH:MM", local). Logs refuse the future, so check `isPast` before
   * logging one that may land later today.
   */
  moment(offset: number, time: string): string;
  /** Whether a moment from `moment()` has already happened. */
  isPast(iso: string): boolean;
}

export function lifeClock(visitDay: DateStr, now: () => Date = () => new Date()): LifeClock {
  const day = (offset: number) => addDays(visitDay, offset);
  return {
    today: visitDay,
    day,
    moment: (offset, time) => new Date(`${day(offset)}T${time}:00`).toISOString(),
    isPast: (iso) => new Date(iso).getTime() <= now().getTime(),
  };
}
