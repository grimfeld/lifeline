# The Media App splits into four family Apps plus a Commonplace book; duplicated logic over shared abstractions

The one Media App (ADR 0006 and amendments) funnelled six media types through one screen and one medium-neutral model. In use, three complaints compounded: one crammed destination (chip-filtering to reach the medium you came for), medium-neutral chrome (the same furniture for a novel and a video game), and a bland identity — and beneath them a real model divergence: Acquisition is meaningless for streamed media, visual media want image features books never will, and per-family extension kept threading through shared code.

Media becomes **five Apps**, each owning its types outright, with **deliberately duplicated, per-family-trimmed logic** instead of a shared media package:

- **Library** (`book`, `comic`) — Nightstand (slots 5/3) in its own tab, Acquisition + Shopping list, Open Library/Google Books/ComicVine lookups.
- **Cinema** (`movie`, `series`) — no Acquisition (you stream), TMDB lookup.
- **Discotheque** (`music`) — no Acquisition, keyless MusicBrainz lookup, no settings type.
- **Arcade** (`game`) — Acquisition + Shopping list, RAWG lookup.
- **Commonplace book** (`quote`) — passages from a work of *any* family (the link stays medium-wide; reading another App's Documents is allowed, and every Quote operation is a Quote operation), with the capture flow and all quote cards.

Shared shape across the four family Apps: the four-state Shelf under each family's verbs, and a **Gallery as the main screen** — a wall-to-wall cover grid you land on (All, never pre-filtered), with search, sort, quick add, and a medium chip only where an App owns two types. The **Studied mark is deleted everywhere; Reason becomes an optional detail never asked at add.** `media_settings` splits into per-App settings types, keys copied once from the old record. Type ids are unchanged, so documents need no migration; stored `media.*` Card instances are *not* migrated — they show "unavailable" and are re-added by hand from the new per-App cards.

## Considered options

- One App with four tailored screens (the sidebar lists screens, so it looks identical) — rejected by the user: metadata shapes and features genuinely diverge per family (shopping lists fit books/games but not streamed media; stills/screenshots fit visual media only), and extension should not thread through shared ownership.
- A shared `media-core` package under the four Apps — rejected: it recreates the coupling the split exists to remove; the duplicated shelf/enrich code is small and each copy is free to diverge.
- Library owns Quote (smallest move) — rejected for a fifth App: a quote from a film living in a books App is a lie the Commonplace book doesn't have to tell.
- Narrowing Quote to books/comics, or one quote type per family — rejected: orphans existing film/album quotes; four capture flows.
- Best-effort migration of stored Card instances — rejected: "Any medium" instances have no cross-family successor, and silently remapping them to one family changes meaning; a visible gap that shows the new menu is honest and costs one user minutes.
- Keeping Studied per-family — rejected: unused; deleted outright rather than carried.

## Consequences

- Reverses ADR 0006's "one App, medium as a registry entry" for media; "one App owns several types" (ADR 0019) is still exercised — by Library, Cinema and the Museum.
- Five manifests, five colors, five daylogs; four quick-add capture commands plus quote capture on the phone sheet.
- Acquisition fields simply leave the `movie`/`series`/`music` type defs; stray stored values remain harmlessly on old rows.
- "Media item" is a retired glossary term; nothing needs a collective name for the six types anymore.
- Future per-family features (Cinema stills, richer per-family metadata) land inside one App each, never through shared code — that ease is the point of the split.
