/// <reference path="../pb_data/types.d.ts" />

// A device's pull (packages/core/src/data/sync.ts) lists one collection as
// `owner = me` (the list rule, ADR 0039) and `updated > cursor`, sorted by
// `updated`. The `owner` index alone leaves SQLite reading and sorting every
// row the Account has, each cycle; `(owner, updated)` answers it directly.
// Every synced collection — the same list as pb_hooks/owner.pb.js.

const COLLECTIONS = ["documents", "placements", "screens", "views", "document_types", "attachments", "workspaces"];

const indexName = (name) => `idx_${name}_owner_updated`;

migrate(
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      if (c.indexes.some((i) => i.includes(indexName(name)))) continue;
      c.indexes.push(`CREATE INDEX ${indexName(name)} ON ${name} (owner, updated)`);
      app.save(c);
    }
  },
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.indexes = c.indexes.filter((i) => !i.includes(indexName(name)));
      app.save(c);
    }
  },
);
