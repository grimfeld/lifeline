/// <reference path="../pb_data/types.d.ts" />

// ADR 0044: Mood becomes its own App. Every daily note carrying a `mood`
// (1..5) becomes a Mood Document titled by that note's date, owned by the
// same account, and the field leaves the note. `updatedAt` is bumped on the
// rewritten notes so LWW clients accept them on pull; the new Moods carry
// the note's own date as `createdAt` so backdated history reads honestly.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function newId() {
  let out = "";
  for (let i = 0; i < 15; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function readFields(r) {
  try {
    return JSON.parse(r.getString("fields") || "{}") || {};
  } catch (_) {
    return {};
  }
}

/** 1..5 as a number, or null for "no mood recorded". */
function readLevel(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);

migrate(
  (app) => {
    const docs = app.findCollectionByNameOrId("documents");
    const dailies = app.findRecordsByFilter("documents", 'type = "daily"', "", 0, 0);
    const now = new Date().toISOString();
    // One Mood per day per owner: a Mood already there wins over the field.
    const taken = {};
    for (const r of app.findRecordsByFilter("documents", 'type = "mood"', "", 0, 0)) {
      taken[r.getString("owner") + "|" + r.getString("title")] = true;
    }

    for (const note of dailies) {
      const fields = readFields(note);
      const level = readLevel(fields.mood);
      const date = note.getString("title");
      if (level === null) continue;
      delete fields.mood;
      note.set("fields", fields);
      note.set("updatedAt", now);
      app.save(note);
      if (!isDate(date)) continue;
      const key = note.getString("owner") + "|" + date;
      if (taken[key]) continue;
      taken[key] = true;
      const mood = new Record(docs);
      mood.set("id", newId());
      mood.set("updatedAt", now);
      mood.set("deleted", note.getInt("deleted") ? 1 : 0);
      mood.set("type", "mood");
      mood.set("title", date);
      mood.set("body", "");
      mood.set("tags", []);
      mood.set("folder", "");
      mood.set("createdAt", date);
      mood.set("fields", { level });
      mood.set("owner", note.get("owner"));
      app.save(mood);
    }
  },
  (app) => {
    // Back into the daily notes: each Mood's level returns to its day's note,
    // and the Mood Documents go. A Mood on a day with no note is dropped —
    // the field could not hold it.
    const dailies = app.findRecordsByFilter("documents", 'type = "daily"', "", 0, 0);
    const byDate = {};
    for (const n of dailies) byDate[n.getString("owner") + "|" + n.getString("title")] = n;
    const now = new Date().toISOString();
    for (const mood of app.findRecordsByFilter("documents", 'type = "mood"', "", 0, 0)) {
      const level = readLevel(readFields(mood).level);
      const note = byDate[mood.getString("owner") + "|" + mood.getString("title")];
      if (note && level !== null) {
        const fields = readFields(note);
        fields.mood = String(level);
        note.set("fields", fields);
        note.set("updatedAt", now);
        app.save(note);
      }
      app.delete(mood);
    }
  },
);
