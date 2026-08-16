/// <reference path="../pb_data/types.d.ts" />

// Calendar App: `events` — fixed-time things (timed on one day, or all-day
// spanning date..endDate). Same synced-record skeleton as 1755100000_lifeline_init.js.

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

migrate(
  (app) => {
    app.save(
      makeCollection(
        "events",
        "ev",
        [
          text("ev", "title", true, 255),
          text("ev", "notes", false, 0),
          text("ev", "date", true, 10),
          text("ev", "endDate", false, 10),
          text("ev", "start", false, 5),
          text("ev", "end", false, 5),
          text("ev", "createdAt", true, 10),
        ],
        ["CREATE INDEX idx_ev_date ON events (date)"],
      ),
    );
  },
  (app) => {
    const c = app.findCollectionByNameOrId("events");
    if (c) app.delete(c);
  },
);
