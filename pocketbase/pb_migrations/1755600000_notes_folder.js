/// <reference path="../pb_data/types.d.ts" />

// Notes App (ADR 0013): real folders — `notes.folder` is a "/"-separated path, "" = root.

migrate(
  (app) => {
    const c = app.findCollectionByNameOrId("notes");
    c.fields.add(
      new TextField({
        id: "nt_folder",
        name: "folder",
        max: 500,
        min: 0,
        required: false,
        presentable: false,
        system: false,
      }),
    );
    c.indexes.push("CREATE INDEX idx_nt_folder ON notes (folder)");
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("notes");
    c.fields.removeByName("folder");
    c.indexes = c.indexes.filter((i) => !i.includes("idx_nt_folder"));
    app.save(c);
  },
);
