# Museum App: classical art as five artwork types; curation as exhibitions of rooms

The Media App deliberately covers *consumed* works (read/watch/listen/play — a Shelf is a consumption state). Art I admire has no consumption state, and a browsable catalog would be nearly free (any type gets a Base); the reason to write an App is **curation**: a Museum where most of the **Holdings** sit in storage and chosen works are *hung*.

Each art form is its own built-in Document type — **painting, drawing, photography, sculpture, architecture** — all owned by the one Museum App, defs looped over an art-form registry (ADR 0019 amendment pattern). Shared shape: artist (Link), free-text year ("c. 1503"), image by URL, location text, a **Seen** boolean, optional commentary body; object forms add materials/dimensions as text; **architecture implements Locatable** through a geo field. **Artist** is a built-in Reference type (Linkable by name/alias; "works by" is backlinks, never stored). An **Exhibition** is a named, curated selection arranged into ordered **Rooms** — free-form sections of exactly one exhibition, mixing art forms at will — with lifecycle **In preparation → Hanging → Archived**; *hang*/*take down* are the only verbs, take-down always archives, several exhibitions may hang at once. A Room is an *internal* Document type (exhibition Link, order, guarded json list of artwork ids — no field kind holds an ordered list of links). Viewing is a room-by-room walk; one configurable **On display** Card rotates a daily artwork from the hung shows. Lookup: **Wikidata only** (keyless, CORS-open, `externalKey: wikidata:Q…`), Media's fill-empty-fields-only semantics, auto-creating unknown artists. Images stay URLs — no file storage.

## Considered options

- A seventh-plus medium in the Media App — rejected: Media's model is the Shelf (a consumption state) and Nightstand slots; artworks are never "in progress". Bolting stateless types onto it would fork every screen on a flag.
- One `artwork` type with an art-form select — rejected: forms differ in fields (a building has coordinates, a sculpture a material), per-form Bases are what you browse, and `[[painting:…]]` prefixes need types. Matches the Media split (ADR 0019 amendment).
- Painting/sculpture Locatable at their museum — rejected: the work is not a place; that would pin the museum, a different feature.
- One wall (an "on display" flag per artwork) — rejected: no history, no intent; an exhibition is the artifact ("what was I into last winter").
- Exactly one exhibition hanging (Nightstand-style forcing function) — rejected by the user: shows serve different moods/forms concurrently; scarcity earns nothing here.
- Rooms as json inside the exhibition (Chore-schedule precedent) — rejected: the user wants Rooms as real (internal) Documents with their own Base; only the artwork ordering stays opaque json.
- Reusable rooms shared across exhibitions — rejected: shared-ownership edits across shows for a reuse case never hit.
- Uploaded image files — rejected for now: would be the system's first file field, outside the record-only Dexie sync (ADR 0002); a system-wide decision to take only if link rot actually bites the walls.
- Museum APIs (The Met, AIC…) as lookup — rejected as first provider: N integrations each covering one museum's holdings; Wikidata covers all forms and yields Commons image URLs and coordinates.

## Consequences

- Eight built-in types under one App: five artwork forms + `artist` + `exhibition` + internal `room`; adding printmaking is one registry entry.
- First built-in type beyond user-defined geo fields to implement Locatable: admired buildings appear as Pins on map Surfaces.
- Exhibition state is a guarded select moved only by App operations (`hang`, `takeDown`, `reopen`); archived shows keep their rooms intact and are re-hangable.
- "Gallery" stays Media's word; the Museum's everything-set is the **Holdings** ("collection" stays a Stat kind).
- No Schedulable/Timed/Daylog: artworks are not work on days; Seen is a boolean, not a visit log.
