/// <reference path="../pb_data/types.d.ts" />

// Lifeline initial schema. Every synced collection shares the same skeleton:
// client-generated 15-char id, `updatedAt` (client LWW clock, ISO text),
// `deleted` tombstone (0|1), plus server `created`/`updated` autodates used
// as the pull cursor. All access requires an authenticated user.

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
    {
      hidden: false,
      id: prefix + "_created",
      name: "created",
      onCreate: true,
      onUpdate: false,
      presentable: false,
      system: false,
      type: "autodate",
    },
    {
      hidden: false,
      id: prefix + "_updated",
      name: "updated",
      onCreate: true,
      onUpdate: true,
      presentable: false,
      system: false,
      type: "autodate",
    },
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

function json(prefix, name, required) {
  return {
    hidden: false,
    id: prefix + "_" + name,
    maxSize: 0,
    name,
    presentable: false,
    required: !!required,
    system: false,
    type: "json",
  };
}

function number(prefix, name) {
  return {
    hidden: false,
    id: prefix + "_" + name,
    name,
    onlyInt: false,
    presentable: false,
    required: false,
    system: false,
    type: "number",
  };
}

function makeCollection(name, prefix, extraFields, indexes) {
  return new Collection({
    name,
    type: "base",
    listRule: AUTH_RULE,
    viewRule: AUTH_RULE,
    createRule: AUTH_RULE,
    updateRule: AUTH_RULE,
    deleteRule: AUTH_RULE,
    fields: [...baseFields(prefix), ...extraFields, ...autodates(prefix)],
    indexes: indexes ?? [],
  });
}

migrate(
  (app) => {
    app.save(
      makeCollection("chores", "ch", [
        text("ch", "name", true, 200),
        text("ch", "category", false, 100),
        text("ch", "status", true, 20),
        json("ch", "schedule", true),
        text("ch", "anchorDate", false, 10),
        text("ch", "createdAt", true, 10),
      ]),
    );

    app.save(
      makeCollection(
        "chore_completions",
        "cc",
        [
          text("cc", "choreId", true, 15),
          text("cc", "doneOn", true, 10),
          text("cc", "recordedAt", true, 40),
        ],
        ["CREATE INDEX idx_cc_choreId ON chore_completions (choreId)"],
      ),
    );

    app.save(
      makeCollection(
        "placements",
        "pl",
        [
          text("pl", "appId", true, 50),
          text("pl", "itemId", true, 50),
          text("pl", "date", true, 10),
        ],
        ["CREATE INDEX idx_pl_item ON placements (appId, itemId)"],
      ),
    );

    app.save(
      makeCollection("screens", "sc", [
        text("sc", "name", true, 100),
        json("sc", "layout", false),
        number("sc", "sort"),
      ]),
    );
  },
  (app) => {
    for (const name of ["chores", "chore_completions", "placements", "screens"]) {
      const c = app.findCollectionByNameOrId(name);
      if (c) app.delete(c);
    }
  },
);
