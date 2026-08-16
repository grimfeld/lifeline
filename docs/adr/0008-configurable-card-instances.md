# Cards are configured per instance on the Screen layout, not generated per entity

Several Cards only make sense against a chosen thing — one Stat as a dashboard tile, one Event as a countdown, one medium's Nightstand — and the user wants several of them side by side on one Screen. Two shapes were possible: (A) keep the compile-time Card registry (ADR 0003) and let a Screen hold *instances* — a layout item carries its own `instanceId` plus a `settings` blob validated against a small schema the `CardDef` declares; or (B) have Apps generate one `CardDef` per entity at runtime ("Stat: Push-ups", "Nightstand: Books") so the picker just lists them. We chose A: the registry stays static and Core-owned, the picker stays small (grouped by App, searchable), a card whose target disappears degrades to an "unavailable — Configure…" state instead of vanishing from the layout, and any Card can grow optional knobs (period, count, medium) without multiplying definitions.

## Consequences

- `ScreenLayoutItem` gains `instanceId` (the react-grid-layout key) and `settings`; existing layouts migrate with `instanceId = cardId`. The same `cardId` may appear many times on a Screen.
- `CardDef` gains an optional `settings` schema (field kinds: `number`, `select`, `entity` — the latter backed by an App-supplied live options hook), an optional `instanceTitle(settings)` (called as a React hook, so Apps can resolve names from live data), and its component receives `settings` as a prop.
- Cards with a required field open the configure form before being added; optional-only cards are added with defaults and configured via a gear in edit mode. Titles are derived by the App; there is no user rename.
- The picker groups Cards by App and offers search; no separate category taxonomy.
