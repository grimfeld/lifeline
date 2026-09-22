/// <reference path="../pb_data/types.d.ts" />

// PocketBase text fields with max=0 are NOT unlimited: PB applies a default
// cap of 5000 characters. Documents with long bodies failed to sync
// (PATCH 400 "Must be no more than 5000 character(s)."). Give the prose
// fields an explicit, generous limit.

const LIMITS = [
  ["documents", "body", 1000000],
  ["document_types", "template", 1000000],
];

migrate(
  (app) => {
    for (const [colName, fieldName, max] of LIMITS) {
      const col = app.findCollectionByNameOrId(colName);
      const field = col.fields.getByName(fieldName);
      field.max = max;
      app.save(col);
    }
  },
  (app) => {
    // Down: restore the implicit default (max=0 -> 5000).
    for (const [colName, fieldName] of LIMITS) {
      const col = app.findCollectionByNameOrId(colName);
      const field = col.fields.getByName(fieldName);
      field.max = 0;
      app.save(col);
    }
  },
);
