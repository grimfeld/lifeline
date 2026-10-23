---
status: accepted
---

# The Private folder is a gate against eyes and agents, not encryption

The codebase audit (#271) asked whether ADR 0038's threat model was intended. Private Documents are plain text in IndexedDB and on the server, the password's PBKDF2 hash syncs in a Document, and the unlock back-off lived in memory.

**Yes: Private keeps eyes at the screen and agents away, and is not encryption.** The agents part holds because the MCP server's handlers refuse Private Documents (`isAgentVisible`, `assertNotPrivate`), not because it can't read them. Two things change:

- **The copy says exactly that.** The set-up dialog and the Guide say Private Documents are stored and synced as plain text, readable by anyone with the browser's data or the server's database.
- **The unlock back-off survives a reload.** The count of wrong tries in a row is kept in the device's `_meta`, so reloading no longer resets the wait (0.5 s, doubling, at most 8 s).

## Considered options

- **Encrypt Private bodies at rest** with an AES-GCM key derived from the password. Rejected for now: search, sync, conflicts, Peek and the agents would all change, and the threat it answers (someone with the database) already owns the Account (ADR 0002).

## Consequences

- ADR 0038 stands. This ADR records that its threat model was confirmed, and the two changes.
