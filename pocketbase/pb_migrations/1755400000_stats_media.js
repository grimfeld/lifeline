/// <reference path="../pb_data/types.d.ts" />

// Stats App (notch port): `stats` definitions + `stat_entries` event log.
// Media App (nightstand port, generalised): `media` works of any medium.
// Same synced-record skeleton as 1755100000_lifeline_init.js.

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

function number(prefix, name, onlyInt) {
  return {
    hidden: false,
    id: prefix + "_" + name,
    name,
    onlyInt: !!onlyInt,
    presentable: false,
    required: false,
    system: false,
    type: "number",
  };
}

function bool(prefix, name) {
  return { hidden: false, id: prefix + "_" + name, name, presentable: false, required: false, system: false, type: "bool" };
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
      makeCollection("stats", "st", [
        text("st", "name", true, 100),
        text("st", "kind", true, 20),
        text("st", "unit", false, 20),
        text("st", "color", true, 30),
        number("st", "defaultIncrement", false),
        number("st", "universeSize", true),
        text("st", "createdAt", true, 10),
      ]),
    );

    app.save(
      makeCollection(
        "stat_entries",
        "se",
        [
          text("se", "statId", true, 15),
          number("se", "value", false),
          text("se", "item", false, 200),
          text("se", "ts", true, 40),
        ],
        ["CREATE INDEX idx_se_stat_ts ON stat_entries (statId, ts)"],
      ),
    );

    app.save(
      makeCollection(
        "media",
        "md",
        [
          text("md", "type", true, 20),
          text("md", "title", true, 500),
          text("md", "creator", false, 300),
          text("md", "externalKey", false, 200),
          text("md", "coverUrl", false, 500),
          number("md", "size", true),
          number("md", "year", true),
          text("md", "acquisition", true, 20),
          text("md", "engagement", true, 20),
          bool("md", "studied"),
          text("md", "reason", false, 2000),
          number("md", "slot", true),
          text("md", "addedOn", true, 10),
          text("md", "acquiredOn", false, 10),
          text("md", "slottedOn", false, 10),
          text("md", "startedOn", false, 10),
          text("md", "finishedOn", false, 10),
        ],
        [
          "CREATE INDEX idx_md_type_slot ON media (type, slot)",
          "CREATE INDEX idx_md_external ON media (externalKey)",
        ],
      ),
    );
  },
  (app) => {
    for (const name of ["media", "stat_entries", "stats"]) {
      const c = app.findCollectionByNameOrId(name);
      if (c) app.delete(c);
    }
  },
);
