/// <reference path="../pb_data/types.d.ts" />

// Notes App: user-defined Note types (`note_types`) — label, plural, icon name, default folder, properties (JSON).
// Same synced-record skeleton as 1755100000_lifeline_init.js.

const AUTH_RULE = '@request.auth.id != ""';

function text(prefix, name, required, max) {
  return { autogeneratePattern: "", hidden: false, id: prefix + "_" + name, max: max ?? 0, min: 0, name, pattern: "", presentable: false, primaryKey: false, required: !!required, system: false, type: "text" };
}

migrate(
  (app) => {
    app.save(
      new Collection({
        name: "note_types",
        type: "base",
        listRule: AUTH_RULE,
        viewRule: AUTH_RULE,
        createRule: AUTH_RULE,
        updateRule: AUTH_RULE,
        deleteRule: AUTH_RULE,
        fields: [
          { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "ty_id", max: 15, min: 15, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
          text("ty", "updatedAt", true, 40),
          { hidden: false, id: "ty_deleted", max: 1, min: 0, name: "deleted", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
          text("ty", "typeId", true, 40),
          text("ty", "label", true, 100),
          text("ty", "plural", false, 100),
          text("ty", "icon", false, 40),
          text("ty", "folder", false, 500),
          { hidden: false, id: "ty_properties", maxSize: 0, name: "properties", presentable: false, required: false, system: false, type: "json" },
          { hidden: false, id: "ty_order", name: "order", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
          { hidden: false, id: "ty_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
          { hidden: false, id: "ty_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" },
        ],
        indexes: ["CREATE INDEX idx_ty_typeId ON note_types (typeId)"],
      }),
    );
  },
  (app) => {
    const c = app.findCollectionByNameOrId("note_types");
    if (c) app.delete(c);
  },
);
