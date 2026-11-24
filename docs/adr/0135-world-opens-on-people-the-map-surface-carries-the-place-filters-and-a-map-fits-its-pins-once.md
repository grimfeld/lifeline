---
status: accepted
amends: ADR 0128 (in part — World's home is no longer a map), ADR 0011 (in part — a map fits its Pins once, then keeps the view)
---

# World opens on People, the Map Surface carries the Place filters, and a map fits its Pins once

ADR 0128 gave World a home of its own: one map of every Place, every current Address and every Event At one of them. The Map Surface (ADR 0011) already draws every Locatable Document, those included. Two maps of nearly the same Pins is one too many. The only thing World's map had that the Map lacked was its Place filters, Kind and To try.

Every map also refit itself to its Pins whenever they changed, so each filter change threw away the zoom and centre the person had chosen.

- **World has no map.** Its home opens on the People screen. Its places are People and Places (with Households, ADR 0117, when listed).
- **The Map Surface carries Kind and To try**, shown while Places are on the map. They narrow Places and the Events At them (ADR 0122). Addresses, Events At a Person and every other type stay. Session-only, like the type chips.
- **A map fits its Pins once**, the first time it has any, then never moves on its own: not on a filter, and not on a Pin added or removed. A focus still centres. Nothing is remembered across visits.

## Considered options

- **Keep both maps.** Rejected: two places to look for the same Pins, and two filter sets to keep true.
- **Drop Kind and To try.** Rejected: "a café near me I haven't tried" is the reason to open a map of Places.
- **Refit on data changes but not on filters.** Rejected: a Pin syncing in from another device would still yank the view.
- **A "fit to pins" button.** Not now: leaving and coming back fits again.

## Consequences

- `/module/people` redirects to the People screen. Links and Workspaces that take World are unchanged.
- The Map card and a Base's Map layout keep their view too, as they share the map canvas.
- The Map's filter is per Document type. The Place-aware part names Place and Event, which Core already names (ADR 0100).
