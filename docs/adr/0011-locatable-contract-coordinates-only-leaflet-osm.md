# Locatable contract carries coordinates only, geocoded at edit time; maps are Leaflet over OSM raster tiles

The Map is a Core Surface (screen, Card, and a reusable mini-map) over a new `Locatable` Contract, so any App can put its entities on a map (ADR 0001) — the Notes App's Place notes are the first provider. The Contract exposes *Pins* with resolved coordinates only: address → coordinates (Nominatim, OSM's geocoder) happens once, on an explicit "Locate" click while editing the owning entity, and the result is stored in that entity and syncs with it. The Surface never geocodes at render time — that would be slow, opaque when it fails, and violate Nominatim's usage policy (1 req/s, cache results, no bulk) as pins multiply. Rendering is Leaflet with `tile.openstreetmap.org` raster tiles: zero-config, runs in the Tauri/Android/web webviews without WebGL concerns, and free for one user's traffic; MapLibre vector tiles were rejected because OSM does not serve them and every provider needs a key or self-hosting.

## Considered options

- Notes-only map feature — rejected: forces every future "where" (Events, Chores…) into a Note.
- Render-time geocoding with a local cache — rejected (policy, latency, hidden failures).
- Auto-geocode on address blur — deferred: Nominatim returns confident garbage for partial addresses.
- MapLibre GL / vector tiles — rejected for v1 (needs a keyed provider or self-hosting).

## Consequences

- Notes store coordinates as `location: [lat, lon]` frontmatter, the format Obsidian's Map View plugin reads, so vault round-tripping (ADR 0009) holds; an entity with an address but no coordinates is simply not on the map.
- The map needs network for tiles; offline tile packs, clustering and remembered viewports are explicitly out of v1.

## Amendment (Aug 2026)

Address typeahead: suggestions while typing come from Photon (komoot's open geocoder over OSM data — free, keyless, meant for autocomplete, which Nominatim's policy forbids); picking a suggestion fills the coordinates and, when empty, the address. The explicit "Locate" action stays on Nominatim.
