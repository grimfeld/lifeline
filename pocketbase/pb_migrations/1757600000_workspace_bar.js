/// <reference path="../pb_data/types.d.ts" />

// ADR 0053: the Phone bar is configured rather than derived, and the
// arrangement belongs to the Workspace — `workspaces.bar`, synced, so it
// follows the user between phones. ADR 0047 settled that reasoning already:
// per-device prefs do not travel, which is why the user-created thing lives on
// the synced Workspace.
//
// Declared here or it does not exist: PocketBase's schema is strict, so a
// `bar` the client pushes into an undeclared field is dropped on the way in —
// silently, and only on other devices, which is the worst shape a bug has.
//
// No backfill. A Workspace with no `bar` seeds from its own Modules when it is
// first read (`seedBar`), so old rows and new take one code path and nothing
// re-pulls. `screens.phoneHome` is deliberately left in place: nothing reads it
// any more (Phone home is retired), and dropping a column to reclaim nothing is
// not worth an irreversible migration.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("workspaces");
    c.fields.add(
      new JSONField({
        id: "ws_bar",
        name: "bar",
        // Two slots, each a small tagged ref with an optional label. 2000 is
        // what `modules` takes on the same collection.
        maxSize: 2000,
        required: false,
        presentable: false,
        system: false,
      }),
    );
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("workspaces");
    c.fields.removeByName("bar");
    app.save(c);
  },
);
