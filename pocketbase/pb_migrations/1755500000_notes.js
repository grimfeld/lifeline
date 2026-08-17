/// <reference path="../pb_data/types.d.ts" />

// Notes App (ADR 0009): `notes` — title + raw markdown body; everything else is derived client-side.
// Same synced-record skeleton as 1755100000_lifeline_init.js. Body has no size cap.

const AUTH_RULE = '@request.auth.id != ""';

function baseFields(prefix) {
  return [
    {
      autogeneratePattern: "[a-z0-9]{15}",
      hidden: false,
      id: prefix + "_id",
      max: 15,
      min: 15,
      name: "id",
      pattern: "^[a-z0-9]+$",
      presentable: false,
      primaryKey: true,
      required: true,
      system: true,
      type: "text",
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: prefix + "_updatedAt",
      max: 40,
      min: 0,
      name: "updatedAt",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: true,
      system: false,
      type: "text",
    },
    {
      hidden: false,
      id: prefix + "_deleted",
      max: 1,
      min: 0,
      name: "deleted",
      onlyInt: true,
      presentable: false,
      required: false,
      system: false,
      type: "number",
    },
  ];
}

function autodates(prefix) {
  return [
    { hidden: false, id: prefix + "_created", name: "created", onCreate: true, onUpdate: false, presentable: false, system: false, type: "autodate" },
    { hidden: false, id: prefix + "_updated", name: "updated", onCreate: true, onUpdate: true, presentable: false, system: false, type: "autodate" },
  ];
}

function text(prefix, name, required, max) {
  return {
    autogeneratePattern: "",
    hidden: false,
    id: prefix + "_" + name,
    max: max ?? 0,
    min: 0,
    name,
    pattern: "",
    presentable: false,
    primaryKey: false,
    required: !!required,
    system: false,
    type: "text",
  };
}

migrate(
  (app) => {
    app.save(
      new Collection({
        name: "notes",
        type: "base",
        listRule: AUTH_RULE,
        viewRule: AUTH_RULE,
        createRule: AUTH_RULE,
        updateRule: AUTH_RULE,
        deleteRule: AUTH_RULE,
        fields: [
          ...baseFields("nt"),
          text("nt", "type", true, 20),
          text("nt", "title", true, 500),
          text("nt", "body", false, 0),
          text("nt", "createdAt", true, 10),
          ...autodates("nt"),
        ],
        indexes: ["CREATE INDEX idx_nt_type_title ON notes (type, title)"],
      }),
    );
  },
  (app) => {
    const c = app.findCollectionByNameOrId("notes");
    if (c) app.delete(c);
  },
);
