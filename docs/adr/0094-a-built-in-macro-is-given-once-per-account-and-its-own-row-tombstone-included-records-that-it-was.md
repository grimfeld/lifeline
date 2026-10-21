---
status: accepted
---

# A built-in Macro is given once per account, and its own row, tombstone included, records that it was

Lifeline ships built-in Macros (ADR 0092; the first is the morning one). Each is given to an account once, as an ordinary Macro of the user's own, to edit, reset or delete, and a deleted one must never come back, on any device. That needs a record, per account and synced, of which built-ins were already given. `_meta` is per device and is erased with the device, so it cannot be that record.

**The given Macro's own row is the record.** A built-in is seeded as a row of `macros` carrying a `builtin` id (`"morning"`). Synced rows are never purged: deleting one leaves a tombstone (`deleted: 1`) on the server and, after a pull, on every device, and the tombstone keeps its `builtin` id. Seeding (`ensureBuiltinMacros`, `packages/core/src/builtinMacros.ts`) gives only the built-ins that no row, living or dead, carries.

- Seeding waits until `macros` has been pulled once on the device (`hasPulledOnce`), as the first Workspace does (ADR 0047): before that, a new device knows neither the copy another device was given nor its tombstone.
- A signed-in account seeds a built-in under an id derived from the account and the built-in, the same on every device. Two devices seeding at the same moment, each before seeing the other's row, then write one row, which the sync's last-writer-wins settles.
- An edit keeps the `builtin` id. **Reset to default** rewrites the name and steps from the definition in code. A later release changes only that definition, never a copy already given.

## Considered options

- **A separate synced collection of "given" markers**: rejected. It would need its own collection, migration, owner hooks and pull index, and would only repeat what the tombstone already says.
- **A `_meta` flag**: rejected. It is local to one device, so a second device, or the same one after Erase, would seed the deleted built-in again.

## Consequences

- If tombstones are ever purged, the purge must keep those of built-ins (rows with a `builtin` id), or deleted built-ins come back.
