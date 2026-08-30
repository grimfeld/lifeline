/// <reference path="../pb_data/types.d.ts" />

// ADR 0037: Attachments — images dropped or pasted into a Document's body.
// Core records, not Documents: name (the identity bodies embed by), mime,
// size, and the bytes in a protected file field (served only with a file
// token). No unique index on `name`: uniqueness is the client's rule, and a
// server-side rejection would leave an offline device's push stuck for good.

const AUTH_RULE = '@request.auth.id != ""';

migrate(
  (app) => {
    const c = new Collection({
      name: "attachments",
      type: "base",
      listRule: AUTH_RULE,
      viewRule: AUTH_RULE,
      createRule: AUTH_RULE,
      updateRule: AUTH_RULE,
      deleteRule: AUTH_RULE,
      fields: [
        { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "at_id", max: 15, min: 1, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
        { autogeneratePattern: "", hidden: false, id: "at_updatedAt", max: 40, min: 0, name: "updatedAt", pattern: "", presentable: false, primaryKey: false, required: true, system: false, type: "text" },
        { hidden: false, id: "at_deleted", max: 1, min: 0, name: "deleted", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
        { autogeneratePattern: "", hidden: false, id: "at_name", max: 255, min: 0, name: "name", pattern: "", presentable: true, primaryKey: false, required: true, system: false, type: "text" },
        { autogeneratePattern: "", hidden: false, id: "at_mime", max: 100, min: 0, name: "mime", pattern: "", presentable: false, primaryKey: false, required: false, system: false, type: "text" },
        { hidden: false, id: "at_size", max: null, min: null, name: "size", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
        {
          hidden: false,
          id: "at_file",
          name: "file",
          maxSelect: 1,
          maxSize: 20971520,
          mimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif", "image/bmp"],
          presentable: false,
          protected: true,
          required: false,
          system: false,
          thumbs: [],
          type: "file",
        },
        { hidden: false, id: "at_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
        { hidden: false, id: "at_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" },
      ],
      indexes: ["CREATE INDEX idx_attachments_updated ON attachments (updated)", "CREATE INDEX idx_attachments_name ON attachments (name)"],
    });
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("attachments");
    app.delete(c);
  },
);
