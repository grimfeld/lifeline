/// <reference path="../pb_data/types.d.ts" />

// ADR 0068: a user-defined Document type may name the one Module it is homed
// in — Person and Place in the Journal — so `document_types` gains `module`.
// Empty means none, and nothing written before has one.

migrate(
  (app) => {
    const types = app.findCollectionByNameOrId("document_types");
    if (!types.fields.getByName("module")) {
      types.fields.add(new TextField({ name: "module", max: 60 }));
      app.save(types);
    }
  },
  (app) => {
    const types = app.findCollectionByNameOrId("document_types");
    const f = types.fields.getByName("module");
    if (f) {
      types.fields.removeById(f.id);
      app.save(types);
    }
  },
);
