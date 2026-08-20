/// <reference path="../pb_data/types.d.ts" />

// Phone home (grill 2026-08-20): the one Screen the phone's bottom bar opens
// as Home. A synced bool on `screens`; the client keeps it on at most one.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("screens");
    c.fields.add(
      new BoolField({
        id: "sc_phoneHome",
        name: "phoneHome",
        required: false,
        presentable: false,
        system: false,
      }),
    );
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("screens");
    c.fields.removeByName("phoneHome");
    app.save(c);
  },
);
