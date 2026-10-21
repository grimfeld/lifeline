/// <reference path="../pb_data/types.d.ts" />

// ADR 0039: the server, never the client, decides which Account a record
// belongs to. Every create and update that comes through the API has `owner`
// pinned to the signed-in user — the client does not send it, and an update
// cannot hand a record to someone else. Superusers (the admin UI) are left
// alone so they can set `owner` by hand.
//
// Handlers run in their own VM: the collection list is repeated inline.

onRecordCreateRequest(
  (e) => {
    if (e.auth && e.auth.collection().name === "users") e.record.set("owner", e.auth.id);
    e.next();
  },
  "documents",
  "placements",
  "screens",
  "views",
  "document_types",
  "attachments",
  "workspaces",
  "key_bindings",
);

onRecordUpdateRequest(
  (e) => {
    if (e.auth && e.auth.collection().name === "users") e.record.set("owner", e.auth.id);
    e.next();
  },
  "documents",
  "placements",
  "screens",
  "views",
  "document_types",
  "attachments",
  "workspaces",
  "key_bindings",
);
