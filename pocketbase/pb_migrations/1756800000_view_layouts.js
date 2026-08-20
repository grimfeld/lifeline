/// <reference path="../pb_data/types.d.ts" />

// ADR 0020: Views grow gallery/map/board/calendar layouts. Layouts that read
// one field store the pick on the View: imageField (gallery), geoField (map),
// groupField (board), dateField (calendar).

const FIELDS = ["imageField", "geoField", "groupField", "dateField"];

migrate(
  (app) => {
    const col = app.findCollectionByNameOrId("views");
    for (const name of FIELDS) {
      col.fields.add(new TextField({ id: "vw_" + name, name, max: 60, min: 0, required: false, presentable: false, system: false }));
    }
    app.save(col);
  },
  (app) => {
    const col = app.findCollectionByNameOrId("views");
    for (const name of FIELDS) col.fields.removeById("vw_" + name);
    app.save(col);
  },
);
