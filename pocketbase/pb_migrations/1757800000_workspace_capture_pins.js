/// <reference path="../pb_data/types.d.ts" />

// The capture sheet's pins (CONTEXT.md "Capture sheet") belong to the
// Workspace, like its Phone bar — `workspaces.capturePins`, synced, so they
// follow the user between phones and to the desk's palette.
//
// Declared here or it does not exist: PocketBase's schema is strict, and an
// undeclared field is dropped on the way in (see 1757600000_workspace_bar).
//
// No backfill: a Workspace without pins has none, and that is the start state.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("workspaces");
    c.fields.add(
      new JSONField({
        id: "ws_capture_pins",
        name: "capturePins",
        // A handful of short keys.
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
    c.fields.removeByName("capturePins");
    app.save(c);
  },
);
