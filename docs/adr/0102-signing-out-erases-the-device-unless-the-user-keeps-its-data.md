---
status: accepted
---

# Signing out erases the device unless the user keeps its data

Signing out used to clear only PocketBase's auth store (#261). The local copy stayed in IndexedDB, Private Documents included, in plain text. On a shared device, the next person could read all of it offline after "sign out".

**Signing out now asks, and erases the device by default.** It forgets the session's token and deletes the local database (`eraseDevice`, the same as Erase local data), then reloads. What is synced stays on the server and comes back on the next sign-in. The dialog warns when local changes have not reached the server. A **Keep this device's data** checkbox, off by default, keeps the copy for working locally, and locks Private.

## Considered options

- **Keep the data and only lock Private.** Rejected as the default: everything outside Private would still be readable by the next person, and that is most of a life.
- **Always erase, no choice.** Rejected: on the user's own laptop, working locally while signed out is a real use (ADR 0039).

## Consequences

- Core's `signOut({ keepData })` is the one way to sign out from the UI. The sign-in conflict's "cancel" still signs out keeping data, because there the data belongs to the other Account and erasing it would lose its unsynced writes.
- Shortening PocketBase's auth token lifetime is a server setting, left to the operator.
