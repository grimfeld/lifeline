import { useMemo } from "react";
import type { TimedProvider } from "@lifeline/core";
import { occasionMarkersIn, personOfMarker } from "./domain/occasions";
import { allPeople, usePeople } from "./data/repo";
import { personHref } from "./constants";

/**
 * Occasions on the time Surfaces (#404 stories 24-31): each an all-day marker
 * on its day, taking no hours, drawn like a Deadline's flag but never red and
 * never a Deadline. Read-only — no move, reschedule, create, remove or rename —
 * so a marker can't be dragged and is no Event; it opens its Person.
 */
export const contactsTimed: TimedProvider = {
  appId: "contacts",

  useItems(range) {
    const people = usePeople();
    const { start, end } = range;
    return useMemo(() => occasionMarkersIn(people, { start, end }), [people, start, end]);
  },

  async itemsIn(range) {
    return occasionMarkersIn(await allPeople(), range);
  },

  href(itemId) {
    return personHref(personOfMarker(itemId));
  },
};
