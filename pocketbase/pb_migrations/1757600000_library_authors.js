/// <reference path="../pb_data/types.d.ts" />

// ADR 0052: Authors become Library Documents, linked many-to-many. Every
// `creator` string on a book or comic is split into names ("A / B", "A & B",
// "A, B and C") and each distinct name becomes one `author` Document — no
// outside identity, in the same Account and Workspace scope as its Works —
// while the Work gets `fields.authors` (ids, in order) and loses `creator`.
// Name-only and offline on purpose: resolving against Open Library here would
// guess on "John Williams"; the client's "Resolve authors" does it strictly.
// `updatedAt` is bumped on rewritten Works so LWW clients accept them on pull.
// Doing this here rather than on the client is deliberate (ADR 0047's
// precedent): a client-side pass races itself across devices and leaves two
// Frank Herberts behind.

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const WORK_TYPES = ["book", "comic"];

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

/** Mirrors the client's normalizeAuthorName as far as this runtime allows (no NFD here): case, whitespace and punctuation. */
function nameKey(n) {
  return String(n)
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ]+/g, " ")
    .trim();
}

/** Mirrors the client's splitAuthorNames: "/", "&", ";", "," and " and " separate names. */
function splitNames(raw) {
  const out = [];
  const seen = {};
  const parts = String(raw).split(/\s*(?:\/|&|;|,|\band\b|\bet\b)\s*/i);
  for (const part of parts) {
    const name = part.replace(/\s+/g, " ").trim();
    const key = nameKey(name);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(name);
  }
  return out;
}

const scopeOf = (r) => r.getString("owner") + "|" + r.getString("workspace");

migrate(
  (app) => {
    const docs = app.findCollectionByNameOrId("documents");
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    // Existing Authors (a re-run, or ones made by a client that already upgraded) win over new ones.
    const authorsByScopeName = {};
    for (const a of app.findRecordsByFilter("documents", 'type = "author" && deleted = 0', "", 0, 0)) {
      const fields = readFields(a);
      const names = [a.getString("title")].concat(Array.isArray(fields.aliases) ? fields.aliases : []);
      for (const n of names) {
        const k = scopeOf(a) + "|" + nameKey(n);
        if (!authorsByScopeName[k]) authorsByScopeName[k] = a.getString("id");
      }
    }

    function ensureAuthor(work, name) {
      const k = scopeOf(work) + "|" + nameKey(name);
      if (authorsByScopeName[k]) return authorsByScopeName[k];
      const a = new Record(docs);
      const id = newId();
      a.set("id", id);
      a.set("updatedAt", now);
      a.set("deleted", 0);
      a.set("type", "author");
      a.set("title", name);
      a.set("body", "");
      a.set("tags", []);
      a.set("folder", "");
      a.set("createdAt", today);
      a.set("workspace", work.getString("workspace"));
      a.set("fields", { aliases: [], externalKey: "", photoUrl: "", born: "", died: "" });
      a.set("owner", work.get("owner"));
      app.save(a);
      authorsByScopeName[k] = id;
      return id;
    }

    for (const type of WORK_TYPES) {
      for (const work of app.findRecordsByFilter("documents", 'type = "' + type + '"', "", 0, 0)) {
        const fields = readFields(work);
        if (!("creator" in fields) && Array.isArray(fields.authors)) continue;
        const creator = typeof fields.creator === "string" ? fields.creator : "";
        const authors = Array.isArray(fields.authors) ? fields.authors.slice() : [];
        if (!work.getInt("deleted")) {
          for (const name of splitNames(creator)) {
            const id = ensureAuthor(work, name);
            if (authors.indexOf(id) === -1) authors.push(id);
          }
        }
        delete fields.creator;
        fields.authors = authors;
        work.set("fields", fields);
        work.set("updatedAt", now);
        app.save(work);
      }
    }
  },
  (app) => {
    // Back to a creator string: the Authors' names joined with " / ", in
    // order; then the Author Documents go. Their bodies go with them — a
    // rollback, not a release.
    const now = new Date().toISOString();
    const names = {};
    const authors = app.findRecordsByFilter("documents", 'type = "author"', "", 0, 0);
    for (const a of authors) names[a.getString("id")] = a.getString("title");
    for (const type of WORK_TYPES) {
      for (const work of app.findRecordsByFilter("documents", 'type = "' + type + '"', "", 0, 0)) {
        const fields = readFields(work);
        const ids = Array.isArray(fields.authors) ? fields.authors : [];
        fields.creator = ids.map((id) => names[id] || "").filter(Boolean).join(" / ");
        delete fields.authors;
        work.set("fields", fields);
        work.set("updatedAt", now);
        app.save(work);
      }
    }
    for (const a of authors) app.delete(a);
  },
);
