---
status: accepted
supersedes: ADR 0002 (in part — "single user")
---

# Accounts are isolated by a server-stamped owner on one PocketBase

ADR 0002 assumed a single user and made every collection rule "any signed-in user"; the day a second account was created for a friend, it saw everything. The decision is that the one PocketBase instance now serves many **Accounts** (CONTEXT.md), isolated by an `owner` relation on every synced collection (`documents`, `placements`, `screens`, `views`, `document_types`, `attachments`) that a server hook pins to the signed-in user on every create and update, with list/view/update/delete rules of `owner = @request.auth.id`. The client never sends, stores or knows about `owner`: `toLocal` strips it, the local database stays single-user-shaped, and the sync engine is unchanged except for one guard. Rows that existed before the migration went to the oldest `users` record via raw SQL, so `updated` stayed put and no device re-pulled. Signup is closed (`users.createRule = null`): a superuser makes accounts. Fixed-id singletons ("default", "privatesettings") were replaced by "the one Document of that type", since a second Account could never create the same id. One device holds one Account at a time: the local database is bound to the first Account that syncs through it, and a different sign-in is refused until the user erases the device's local data (blocked while unpushed writes remain) or signs back in as the bound Account.

## Considered options

- **One PocketBase per user** — rejected: zero code, but every friend needs their own Fly app, own URL and own client build (`VITE_PB_URL`) forever, and nothing stops the next friend from being handed the wrong one.
- **Client sends `owner`** with a `@request.body.owner = @request.auth.id` create rule — rejected: every local record would carry a user id, `SyncedRecord` would grow a field with no local meaning, and anonymous-before-first-login data would need re-stamping. The hook is ten lines and unspoofable.
- **A local database per Account** (`lifeline-<userId>`) instead of binding — rejected: the app opens its database before anyone signs in and works signed out, so the anonymous database would need adopting by the first sign-in, and every login/logout would reload anyway. Binding plus an explicit erase-and-switch covers the rare case of switching on one device.

## Consequences

- ADR 0002's "single user" and "all collection rules simply require an authenticated user" are superseded; everything else in it stands.
- Any new synced collection must be added to the migration's list, the hook's list, and get the same rules — a collection without `owner` is visible to everyone.
- A superuser in the admin UI creating a record must set `owner` by hand; the hook only pins for `users` auth.
- Attachments' name uniqueness is now per Account, which the client's rule already gives, since it only ever sees one Account's names.
- A device that pulled everything *before* this ADR shipped keeps those rows: the first sync afterwards binds it to whoever is signed in, pulls only add that Account's rows, and nothing removes the rest. An edit to one of those rows can never push (the view rule hides it, so the engine tries a create, which the id refuses) and stays queued for good. The sync engine names this case, and the sync menu offers an explicit "Erase local data" that wipes the device and re-pulls, allowed even with unpushed writes since those are the ones that can never land.
