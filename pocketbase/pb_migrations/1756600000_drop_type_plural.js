/// <reference path="../pb_data/types.d.ts" />

// Plural is derived (label + "s") — the stored per-type plural is gone.
// Irregular plurals live only as code-side overrides on built-in types.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("document_types");
    c.fields.removeByName("plural");
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("document_types");
    c.fields.add(new TextField({ id: "dty_plural", name: "plural", max: 100, min: 0, required: false, presentable: false, system: false }));
    app.save(c);
  },
);
