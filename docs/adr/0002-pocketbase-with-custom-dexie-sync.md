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

## Amendment (2026-10-22): the server keeps last-writer-wins, and a write only pushes

A push read every record before updating it, to compare the clocks on the
client, and each local write ran a whole cycle: the push, then a pull of every
collection. One typing pause cost a dozen requests and more.

- **The server refuses a stale write.** A hook (`pocketbase/pb_hooks/lww.pb.js`)
  answers an update whose `updatedAt` is older than the stored one with 409 and
  leaves the record alone. The client sends the update straight away, so an
  uncontested edit is one request. On 409 it fetches the server copy, lets the
  App rescue its losing edit (`onConflict`, ADR 0010) and stores the server's
  copy, unless another write to it was queued meanwhile. A 404 still means the
  record is new to the server.
- **A local write pushes and pulls nothing.** What other devices changed
  arrives with the timer, focus, online and the tab coming back.
- **A hidden tab pulls nothing.** The timer waits 30 s while things move and
  stretches to 5 minutes over pulls that find nothing moved either way. A
  local write or a remote change brings the 30 s back; focus, coming back
  online and the tab being shown again do too, and pull at once.

Until the hook is deployed, an update older than the server's copy overwrites
it. The window is the minutes between the web deploy and the PocketBase one.
