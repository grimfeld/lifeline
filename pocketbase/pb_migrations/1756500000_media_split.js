/// <reference path="../pb_data/types.d.ts" />

// Media split (ADR 0006/0019 amendment): the single `media` Document type
// becomes one type per medium — the row's `type` IS its medium (book, comic,
// movie, series, music, game) and the `medium` key leaves the fields JSON.
// `updatedAt` is bumped so LWW clients accept the rewritten rows on pull.

migrate(
  (app) => {
    const rows = app.findRecordsByFilter("documents", 'type = "media"', "", 0, 0);
    const now = new Date().toISOString();
    for (const r of rows) {
      let fields = {};
      try {
        fields = JSON.parse(r.getString("fields") || "{}") || {};
      } catch (_) {}
      const medium = String(fields.medium || "book");
      delete fields.medium;
      r.set("type", medium);
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    const MEDIA = ["book", "comic", "movie", "series", "music", "game"];
    const now = new Date().toISOString();
    for (const medium of MEDIA) {
      const rows = app.findRecordsByFilter("documents", `type = "${medium}"`, "", 0, 0);
      for (const r of rows) {
        let fields = {};
        try {
          fields = JSON.parse(r.getString("fields") || "{}") || {};
        } catch (_) {}
        fields.medium = medium;
        r.set("type", "media");
        r.set("fields", fields);
        r.set("updatedAt", now);
        app.save(r);
      }
    }
  },
);
