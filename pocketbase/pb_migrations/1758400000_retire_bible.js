/// <reference path="../pb_data/types.d.ts" />

// ADR 0071: the Bible App is retired, and with it its types — `bible_book`,
// `bible_chapter`, `verse`, `character`, `concept`. Nothing written is lost:
// a Bible Document with a body becomes a Thought of the same id (its words,
// Tags and links kept; the old type in `fields.bibleType`). One with no body
// held no words of mine — a Verse is a bare reference — and is tombstoned,
// marked `fields.retiredBible` so the down step can bring it back. Links to
// them stay in the text and simply stop resolving to anything special.

const TYPES = ["bible_book", "bible_chapter", "verse", "character", "concept"];

function readFields(r) {
  try {
    return JSON.parse(r.getString("fields") || "{}") || {};
  } catch (_) {
    return {};
  }
}

const filterOf = (types) => types.map((t) => `type = "${t}"`).join(" || ");

migrate(
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", filterOf(TYPES), "", 0, 0)) {
      const fields = readFields(r);
      const type = r.getString("type");
      if (r.getString("body").trim()) {
        r.set("type", "thought");
        r.set("fields", { kind: "", aliases: Array.isArray(fields.aliases) ? fields.aliases : [], bibleType: type, bibleFields: fields });
      } else {
        fields.retiredBible = type;
        r.set("fields", fields);
        r.set("deleted", 1);
      }
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "thought"', "", 0, 0)) {
      const fields = readFields(r);
      if (!fields.bibleType) continue;
      r.set("type", fields.bibleType);
      r.set("fields", fields.bibleFields || {});
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const r of app.findRecordsByFilter("documents", filterOf(TYPES), "", 0, 0)) {
      const fields = readFields(r);
      if (!fields.retiredBible) continue;
      delete fields.retiredBible;
      r.set("fields", fields);
      r.set("deleted", 0);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
);
