---
status: accepted
superseded-by: ADR 0039 (in part — "single user")
---

# PocketBase backend with a custom Dexie-based offline sync layer

> "Single user" and "all collection rules simply require an authenticated user" are superseded by ADR 0039: one instance now serves many Accounts, each seeing only its own rows. The rest stands.

Requirements: desktop + Android (Tauri) + hosted web, offline support everywhere, self-hosted on Fly.io, single user. Supabase was rejected — self-hosting it on Fly means babysitting ~10 services, and its advantages (real Postgres, RLS) are worthless for one user; PowerSync/ElectricSQL were rejected as extra infrastructure. Neither backend has built-in offline sync anyway, so sync lives client-side regardless: one PocketBase instance on Fly (replacing the four existing ones), and one shared sync engine in Core built on Dexie/IndexedDB — outbox push queue, pull via `updatedAt` cursor, soft-delete tombstones, last-write-wins per record.

## Consequences

- Every App gets offline reads/writes for free by storing through Core's data layer; no App builds its own sync.
- LWW is acceptable because a single user on multiple devices produces rare conflicts; notch's old "corrections are online-only, offline queue is append-only" rule is obsolete and dropped.
- Auth is one regular PocketBase user account; all collection rules simply require an authenticated user.
