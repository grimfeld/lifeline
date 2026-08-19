/// <reference path="../pb_data/types.d.ts" />

// Media App: Quotes — passages kept from a Media item (CONTEXT.md "Quote").

const AUTH_RULE = '@request.auth.id != ""';
function text(prefix, name, required, max) {
  return { autogeneratePattern: "", hidden: false, id: prefix + "_" + name, max: max ?? 0, min: 0, name, pattern: "", presentable: false, primaryKey: false, required: !!required, system: false, type: "text" };
}

migrate(
  (app) => {
    app.save(
      new Collection({
        name: "media_quotes",
        type: "base",
        listRule: AUTH_RULE,
        viewRule: AUTH_RULE,
        createRule: AUTH_RULE,
        updateRule: AUTH_RULE,
        deleteRule: AUTH_RULE,
        fields: [
          { autogeneratePattern: "[a-z0-9]{15}", hidden: false, id: "mq_id", max: 15, min: 15, name: "id", pattern: "^[a-z0-9]+$", presentable: false, primaryKey: true, required: true, system: true, type: "text" },
          text("mq", "updatedAt", true, 40),
          { hidden: false, id: "mq_deleted", max: 1, min: 0, name: "deleted", onlyInt: true, presentable: false, required: false, system: false, type: "number" },
          text("mq", "mediaId", true, 15),
          text("mq", "text", true, 0),
          text("mq", "locator", false, 200),
          text("mq", "comment", false, 0),
          text("mq", "capturedOn", true, 10),
          { hidden: false, id: "mq_tags", maxSize: 0, name: "tags", presentable: false, required: false, system: false, type: "json" },
          { hidden: false, id: "mq_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
          { hidden: false, id: "mq_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" },
        ],
        indexes: ["CREATE INDEX idx_mq_media ON media_quotes (mediaId)"],
      }),
    );
  },
  (app) => {
    const c = app.findCollectionByNameOrId("media_quotes");
    if (c) app.delete(c);
  },
);
