# The Stats App drops notch's append-only offline queue but keeps dedupe-at-derivation

notch logged offline through an append-only queue and forbade corrections offline (its ADR 0001) because it had no local database. In Lifeline every App stores through Core's Dexie + outbox sync (ADR 0002 here), so entries are ordinary synced records: logging, editing and deleting all work offline and reconcile by LWW. The queue, the "pending sync" badge and the online-only correction rule are therefore not ported.

notch's ADR 0002 — no uniqueness constraints; Boolean marks dedupe by local day and Collection items by trimmed case-folded name at derivation — is kept as is: it is what makes offline logging on several devices conflict-free.

## Consequences

- `stat_entries` has no unique indexes; aggregate functions in `apps/stats/src/domain/aggregate.ts` are pure, `now`-injectable and tested.
- Periods stay a display filter (trailing 7 / 30 days, calendar YTD, all); Boolean marks are pinned to local noon.
- Detail pages are hidden App screens (`stats/:id`) — the manifest gained `hidden` for routed-but-unlisted screens.
- The named 8-slot chart palette moved into `@lifeline/ui` globals (`--chart-blue` …) and Apps' accent colors reference it.
