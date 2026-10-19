/// <reference path="../pb_data/types.d.ts" />

// ADR 0076: every type chooses its own Reports, built-ins on their override
// record, so `document_types` gains `reports` — a list of { kind, n?, days? }.
// Absent means the defaults, and nothing written before has one.

migrate(
  (app) => {
    const types = app.findCollectionByNameOrId("document_types");
    if (!types.fields.getByName("reports")) {
      types.fields.add(new JSONField({ name: "reports", maxSize: 20000, required: false, presentable: false, system: false }));
      app.save(types);
    }
  },
  (app) => {
    const types = app.findCollectionByNameOrId("document_types");
    const f = types.fields.getByName("reports");
    if (f) {
      types.fields.removeById(f.id);
      app.save(types);
    }
  },
);
