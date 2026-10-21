/// <reference path="../pb_data/types.d.ts" />

// ADR 0094: a built-in Macro is seeded as an ordinary Macro carrying its
// built-in id ("morning"). The id stays on its tombstone, which is what keeps a
// deleted built-in from being seeded again on any device. The schema is strict:
// an undeclared field would be dropped on the way in.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("macros");
    c.fields.add(new TextField({ name: "builtin" }));
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("macros");
    c.fields.removeByName("builtin");
    app.save(c);
  },
);
