/// <reference path="../pb_data/types.d.ts" />

// A Module's Overview is a default the user can rearrange (ADR 0066). The
// user's arrangements belong to the Workspace, like its Phone bar —
// `workspaces.overviews`, by Module id, synced.
//
// Declared here or it does not exist: PocketBase's schema is strict, and an
// undeclared field is dropped on the way in (see 1757600000_workspace_bar).
//
// No backfill: a Workspace without arrangements follows every Module's default.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("workspaces");
    c.fields.add(
      new JSONField({
        id: "ws_overviews",
        name: "overviews",
        // A few Modules' layouts of a dozen Cards each, settings included.
        maxSize: 200000,
        required: false,
        presentable: false,
        system: false,
      }),
    );
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("workspaces");
    c.fields.removeByName("overviews");
    app.save(c);
  },
);
