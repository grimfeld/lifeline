# Graph Surface: canvas + d3-force, derived layout, orphans hidden by default

The last Obsidian capability Lifeline lacked was the graph. It arrives in three shapes sharing one renderer: a Core **Graph** Surface over the Linkable contract (never over types directly, like the Map over Locatable), a **Local graph** panel on the open Document, and a configurable **Graph card** (Document + depth). Nodes are Linkable Documents plus **Ghost nodes** for unresolved names (toggle, default on) and Tags as nodes (toggle, default off — tag nodes connect only to Linkable Documents, so volume types like Entries stay off the graph entirely). Edges are body wikilinks ∪ Link fields, deduplicated to one undirected edge per Document pair, weight kept internally. All edge data comes from the existing derived link index (ADR 0018); the graph adds no stored relations. We designed for 2,000–20,000 nodes: **d3-force as a headless simulation + a hand-written Canvas 2D renderer** (no DOM per node), hit-testing by linear scan, labels appearing by zoom level, node size by log-scaled degree. The simulation is a plain module with a worker-shaped interface (init/tick/positions) running on the main thread until measured to hurt — moving it into a Web Worker is then mechanical. Layout is **derived, never synced**: it settles and freezes (zero CPU when idle), edits reheat it gently with positions carried over by id, and positions persist to localStorage only. Dragged nodes stay where dropped (sticky). **Orphans are hidden by default**: unlike an Obsidian vault, our Linkable population includes whole Bases of structured Documents (every book, person, place), so the default graph shows what is actually connected — Bases already show everything of a type.

## Considered options

- A graph library (sigma.js, cytoscape.js, react-force-graph) — rejected: each brings its own scene model, styling and event system; matching our theming and the triple embedding (Surface, panel, Card) costs more than a ~300-line canvas renderer we fully control.
- WebGL/Pixi (Obsidian's own choice) — rejected as over-engineering for the 2k–20k band; Canvas 2D is comfortable there and the renderer is swappable if the band is ever exceeded.
- Web Worker simulation from day one — rejected: real vaults today are low-thousands and settle instantly; the worker-shaped interface makes the swap-in cheap when the global graph measurably stutters.
- Syncing layout positions (PocketBase) or persisting none at all — rejected: layout is derived data, not content, so it never syncs; but pure per-session layout reshuffles the constellation every restart, so positions cache to localStorage.
- Showing orphans by default (Obsidian's default) — rejected: a Media import would open the graph as thousands of disconnected dots.
- Directed edges / one edge per mention — rejected: arrowheads at graph scale are noise and duplicate mentions say "stronger", not "more edges"; direction and counts stay in the data.

## Consequences

- New deps: `d3-force` (+ types) in `@lifeline/ui`; the graph model itself is pure derivation in `@lifeline/core` over the LinkIndex.
- The Surface's controls (type toggles coloured by owning App, tag filter, search dim/highlight, ghost/tag-node/orphan toggles) persist locally beside the positions.
- Clicking a Ghost node creates the Note, exactly like clicking an unresolved wikilink.
- A Screen's Tag filter treats a Graph card as one unit (visibility), never filtering nodes inside it.
- The link index rebuild already runs on every Document change; the graph defers to it and reheats gently — a body edit that changes no links must not move a node.
