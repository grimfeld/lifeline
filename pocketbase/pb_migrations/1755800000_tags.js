/// <reference path="../pb_data/types.d.ts" />

// Tags (ADR 0014): a `tags` json array on every top-level App record and a
// Screen-level Tag filter. Chores' free-text `category` is folded into tags.

const TAGGED = [
  ["tasks", "tk"],
  ["chores", "ch"],
  ["events", "ev"],
  ["stats", "st"],
  ["media", "md"],
  ["screens", "sc"],
];

migrate(
  (app) => {
    for (const [name, prefix] of TAGGED) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.add(
        new JSONField({
          id: prefix + "_tags",
          name: "tags",
          maxSize: 0,
          required: false,
          presentable: false,
          system: false,
        }),
      );
      app.save(c);
    }
    // Chore.category → tags (normalised: trim, lower-case, spaces → "-").
    const chores = app.findRecordsByFilter("chores", "category != ''", "", 0, 0);
    for (const r of chores) {
      const raw = String(r.get("category") || "").trim();
      const tag = raw
        .replace(/^#/, "")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/^[/-]+|[/-]+$/g, "");
      if (tag) {
        r.set("tags", [tag]);
        app.save(r);
      }
    }
    const c = app.findCollectionByNameOrId("chores");
    c.fields.removeByName("category");
    app.save(c);
  },
  (app) => {
    const c = app.findCollectionByNameOrId("chores");
    c.fields.add(
      new TextField({ id: "ch_category", name: "category", max: 100, min: 0, required: false, presentable: false, system: false }),
    );
    app.save(c);
    for (const [name] of TAGGED) {
      const col = app.findCollectionByNameOrId(name);
      col.fields.removeByName("tags");
      app.save(col);
    }
  },
);
