/// <reference path="../pb_data/types.d.ts" />

// Sources App (ADR 0016): `sources` — things outside Lifeline shown inside it.
// One collection for every kind (`kind` discriminates); first kind: embed
// (name, url, refreshMinutes). Same synced-record skeleton as 1755100000_lifeline_init.js.

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

function json(prefix, name) {
  return { hidden: false, id: prefix + "_" + name, maxSize: 0, name, presentable: false, required: false, system: false, type: "json" };
}

function number(prefix, name) {
  return { hidden: false, id: prefix + "_" + name, name, onlyInt: true, presentable: false, required: false, system: false, type: "number" };
}

migrate(
  (app) => {
    app.save(
      makeCollection(
        "sources",
        "so",
        [
          text("so", "kind", true, 20),
          text("so", "name", true, 255),
          text("so", "url", false, 2000),
          number("so", "refreshMinutes"),
          json("so", "tags"),
          text("so", "createdAt", true, 10),
        ],
        ["CREATE INDEX idx_so_kind ON sources (kind)"],
      ),
    );
  },
  (app) => {
    const c = app.findCollectionByNameOrId("sources");
    if (c) app.delete(c);
  },
);
