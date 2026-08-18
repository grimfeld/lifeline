/// <reference path="../pb_data/types.d.ts" />

// Sources App (ADR 0017): Feed / Calendar subscription / Live value kinds share
// the `sources` collection — add their fields.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("sources");
    const add = (f) => c.fields.add(f);
    add(new JSONField({ id: "so_headers", name: "headers", maxSize: 0, required: false, presentable: false, system: false }));
    add(new TextField({ id: "so_seenUpTo", name: "seenUpTo", max: 40, min: 0, required: false, presentable: false, system: false }));
    add(new TextField({ id: "so_color", name: "color", max: 20, min: 0, required: false, presentable: false, system: false }));
    add(new TextField({ id: "so_mode", name: "mode", max: 10, min: 0, required: false, presentable: false, system: false }));
    add(new TextField({ id: "so_path", name: "path", max: 2000, min: 0, required: false, presentable: false, system: false }));
    add(new TextField({ id: "so_unit", name: "unit", max: 40, min: 0, required: false, presentable: false, system: false }));
    add(new TextField({ id: "so_prefix", name: "prefix", max: 40, min: 0, required: false, presentable: false, system: false }));
    add(new NumberField({ id: "so_decimals", name: "decimals", onlyInt: true, required: false, presentable: false, system: false }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("sources");
    for (const n of ["headers", "seenUpTo", "color", "mode", "path", "unit", "prefix", "decimals"]) c.fields.removeByName(n);
    app.save(c);
  },
);
