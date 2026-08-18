/// <reference path="../pb_data/types.d.ts" />

// Time blocks (ADR 0015): a Placement may carry a start/end time ("HH:MM").

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("placements");
    for (const name of ["start", "end"]) {
      c.fields.add(new TextField({ id: "pl_" + name, name, max: 5, min: 0, required: false, presentable: false, system: false }));
    }
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("placements");
    c.fields.removeByName("start");
    c.fields.removeByName("end");
    app.save(c);
  },
);
