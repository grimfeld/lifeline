/// <reference path="../pb_data/types.d.ts" />

// Media App: lookup provider keys (ADR 0006 amendment, metadata lookups).
// One record, id "default" — hence the relaxed id length.

const AUTH_RULE = '@request.auth.id != ""';
function text(prefix, name, required, max) {
  return { autogeneratePattern: "", hidden: false, id: prefix + "_" + name, max: max ?? 0, min: 0, name, pattern: "", presentable: false, primaryKey: false, required: !!required, system: false, type: "text" };
}

migrate(
  (app) => {
    app.save(
      new Collection({
        name: "media_settings",
        type: "base",
        listRule: AUTH_RULE,
        viewRule: AUTH_RULE,
        createRule: AUTH_RULE,
        updateRule: AUTH_RULE,
        deleteRule: AUTH_RULE,
        fields: [
          { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "ms_id", max: 15, min: 1, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
          text("ms", "updatedAt", true, 40),
          { hidden: false, id: "ms_deleted", max: 1, min: 0, name: "deleted", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
          text("ms", "tmdbKey", false, 200),
          text("ms", "rawgKey", false, 200),
          text("ms", "comicvineKey", false, 200),
          text("ms", "googleBooksKey", false, 200),
          { hidden: false, id: "ms_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
          { hidden: false, id: "ms_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" },
        ],
        indexes: [],
      }),
    );
  },
  (app) => {
    const c = app.findCollectionByNameOrId("media_settings");
    if (c) app.delete(c);
  },
);
