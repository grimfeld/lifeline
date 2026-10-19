# Reports count Days that link, from a fixed catalogue chosen per type

The Journal is where people, places and the other things a life is about get written down, but nothing showed what that writing adds up to: who came up most this month, which place has not been mentioned in a year. A **Report** answers that: a read-only figure or table about the Documents of one type, derived from the link index and never stored. A Report counts **Days that link** to a Document, once per Day however often the name appears, and nothing else. Each type picks its Reports from a **fixed catalogue of hand-built kinds** and sets their order and parameters.

The catalogue starts with link kinds. **Ranking** kinds rank a type's Documents: Top mentioned, Not mentioned in N days. **Per-Document** kinds describe one Document: Last mentioned, Mention count, a 12-month heatmap. Field kinds (group by a Field, upcoming dates) come next. Every Linkable type, built-in or user-defined, starts with Top mentioned and Last mentioned.

## Considered options

- **Count any linking Document (Notes, Thoughts, Tasks…)** — rejected: only a Day *is* a date. Other Documents carry when they were written, not when the thing happened, so "Anna ×6 this month" would stop meaning six days with Anna in them.
- **Count periods too** — rejected: a Month that links Anna is usually summing up Days that already did, so she would be counted twice.
- **Count unlinked mentions** — rejected: a name shared by two Documents would be guessed into the numbers. Linked-only keeps the figures exact and rewards linking.
- **A free-form builder (metric, grouping, filter, window)** — rejected: it is a query language with a UI on top, and it would compete with Views. Hand-built kinds render well in a sidebar, on a Document and as a Card.

## Consequences

- A type's chosen Reports live on its `document_types` record. A built-in's override record carries them, so built-ins need no separate store. User-defined types are set up from the Journal's Types screen, built-ins from their Base settings.
- Where each family shows:
  - A Journal period's sidebar rolls up each type's Top mentioned for that period, hiding types with nothing in it.
  - A type's page shows its ranking kinds, with a window selector.
  - One Document's page shows its per-Document kinds.
  - A Day shows no Reports.
- One generic configurable **Report card** (type, kind, window, and a Document for per-Document kinds) places any Report on a Screen or an Overview.
