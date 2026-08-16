/// <reference path="../pb_data/types.d.ts" />

// Tasks App: `tasks` (one-time + recurring definitions) and `task_occurrences`
// (sparse per-Occurrence overrides of recurring tasks, keyed by taskId +
// sourceDate). Same synced-record skeleton as 1755100000_lifeline_init.js.

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
        "tasks",
        "tk",
        [
          text("tk", "title", true, 255),
          text("tk", "notes", false, 0),
          text("tk", "status", true, 20),
          text("tk", "date", false, 10),
          text("tk", "completedOn", false, 10),
          json("tk", "recurrence", false),
          text("tk", "createdAt", true, 10),
        ],
        ["CREATE INDEX idx_tk_date ON tasks (date)"],
      ),
    );

    app.save(
      makeCollection(
        "task_occurrences",
        "to",
        [
          text("to", "taskId", true, 15),
          text("to", "sourceDate", true, 10),
          text("to", "movedTo", false, 10),
          text("to", "completedOn", false, 10),
        ],
        [
          "CREATE UNIQUE INDEX idx_to_occurrence ON task_occurrences (taskId, sourceDate)",
          "CREATE INDEX idx_to_taskId ON task_occurrences (taskId)",
        ],
      ),
    );
  },
  (app) => {
    for (const name of ["task_occurrences", "tasks"]) {
      const c = app.findCollectionByNameOrId(name);
      if (c) app.delete(c);
    }
  },
);
