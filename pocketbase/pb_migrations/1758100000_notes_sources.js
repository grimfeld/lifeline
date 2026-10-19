/// <reference path="../pb_data/types.d.ts" />

// ADR 0070: the Source is the hub; Quotes absorb Clippings.
//
// 1. The old Sources App's Documents (Embeds, Feeds, Calendar subscriptions,
//    Live values) are Windows now: type `source` → `window`, freeing `source`
//    for the Notes App's own Sources. Base Views follow.
// 2. A Quote's passage moves from `fields.text` to its body, and its work
//    link from `fields.mediaId` to `fields.source`; Quotes get the `Quotes`
//    home Folder.
// 3. Every Clipping becomes a Quote of the same id (links survive). Its
//    free-text `source` becomes a real Source in the same Account and
//    Workspace: one per distinct URL (titled by the clipping's headline, kind
//    article) or per distinct name ("Le Monde, print"); a Clipping with no
//    source gets a Source of its own, titled by its headline. The Quote keeps
//    the headline as its title. `Clippings/…` Folders become `Quotes/…`.
//    What the Clipping carried is kept in `fields.clipping` so the down step
//    can rebuild it.
// 4. Every Workspace that took Note-taking also takes the Journal, which keeps
//    the Vault's layout; `notes` is the Notes Module (the Source shelf) now.
//
// `updatedAt` is bumped on every touched row so LWW clients accept it on pull.

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

function readModules(r) {
  try {
    const v = JSON.parse(r.getString("modules") || "[]");
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

const isUrl = (s) => /^https?:\/\//i.test(s);
const scopeOf = (r) => r.getString("owner") + "|" + r.getString("workspace");
const lower = (s) => String(s).toLowerCase();

function movedFolder(folder, from, to) {
  if (folder === from) return to;
  if (folder.indexOf(from + "/") === 0) return to + folder.slice(from.length);
  return folder;
}

/** A title not yet taken in this scope's Sources folder. */
function freeTitle(title, taken) {
  if (!taken[lower(title)]) return title;
  for (let n = 2; ; n++) {
    const next = title + " (" + n + ")";
    if (!taken[lower(next)]) return next;
  }
}

migrate(
  (app) => {
    const docs = app.findCollectionByNameOrId("documents");
    const now = new Date().toISOString();

    // 1. Windows.
    for (const r of app.findRecordsByFilter("documents", 'type = "source"', "", 0, 0)) {
      r.set("type", "window");
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const v of app.findRecordsByFilter("views", 'type = "source"', "", 0, 0)) {
      v.set("type", "window");
      v.set("updatedAt", now);
      app.save(v);
    }

    // 2. Quotes: passage to the body, work to `source`.
    for (const r of app.findRecordsByFilter("documents", 'type = "quote"', "", 0, 0)) {
      const fields = readFields(r);
      if (typeof fields.text === "string" && !r.getString("body")) r.set("body", fields.text.trim() + "\n");
      delete fields.text;
      if (fields.mediaId !== undefined) {
        fields.source = fields.mediaId;
        delete fields.mediaId;
      }
      r.set("fields", fields);
      if (!r.getString("folder")) r.set("folder", "Quotes");
      r.set("updatedAt", now);
      app.save(r);
    }

    // 3. Clippings → Quotes with real Sources.
    const madeByKey = {}; // scope|url-or-name → source id
    const takenByScope = {}; // scope → { lowered title: true }
    for (const s of app.findRecordsByFilter("documents", 'type = "source"', "", 0, 0)) {
      const t = (takenByScope[scopeOf(s)] = takenByScope[scopeOf(s)] || {});
      t[lower(s.getString("title"))] = true;
    }
    function makeSource(clip, title, fields) {
      const scope = scopeOf(clip);
      const taken = (takenByScope[scope] = takenByScope[scope] || {});
      const name = freeTitle(title || "Kept text", taken);
      taken[lower(name)] = true;
      const s = new Record(docs);
      s.set("id", newId());
      s.set("updatedAt", now);
      s.set("deleted", 0);
      s.set("type", "source");
      s.set("title", name);
      s.set("body", "");
      s.set("tags", []);
      s.set("folder", "Sources");
      s.set("createdAt", clip.getString("createdAt"));
      s.set("fields", Object.assign({ kind: "", url: "", author: "", publishedOn: "", parent: "", aliases: [], madeFrom: "clipping" }, fields));
      s.set("owner", clip.get("owner"));
      s.set("workspace", clip.getString("workspace"));
      app.save(s);
      return s.getString("id");
    }
    for (const c of app.findRecordsByFilter("documents", 'type = "clipping"', "", 0, 0)) {
      const f = readFields(c);
      const origin = String(f.source || "").trim();
      const author = String(f.author || "").trim();
      const published = String(f.publishedAt || "").slice(0, 10);
      const headline = c.getString("title");
      let sourceId;
      if (origin && !c.getInt("deleted")) {
        const key = scopeOf(c) + "|" + lower(origin);
        sourceId = madeByKey[key];
        if (!sourceId) {
          sourceId = isUrl(origin)
            ? makeSource(c, headline, { kind: "article", url: origin, author, publishedOn: published })
            : makeSource(c, origin, { kind: "other", author });
          madeByKey[key] = sourceId;
        }
      } else if (!c.getInt("deleted")) {
        sourceId = makeSource(c, headline, { kind: "article", author, publishedOn: published });
      } else {
        sourceId = "";
      }
      const captured = String(f.capturedAt || "").slice(0, 10) || c.getString("createdAt");
      c.set("type", "quote");
      c.set("folder", movedFolder(c.getString("folder"), "Clippings", "Quotes") || "Quotes");
      c.set("fields", {
        source: sourceId,
        locator: "",
        comment: "",
        capturedOn: captured,
        clipping: { source: f.source || "", author: f.author || "", publishedAt: f.publishedAt || "", capturedAt: f.capturedAt || "" },
      });
      c.set("updatedAt", now);
      app.save(c);
    }
    for (const v of app.findRecordsByFilter("views", 'type = "clipping"', "", 0, 0)) {
      v.set("type", "quote");
      v.set("updatedAt", now);
      app.save(v);
    }

    // 4. The Journal beside Notes.
    for (const w of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      const modules = readModules(w);
      const at = modules.indexOf("notes");
      if (at < 0 || modules.indexOf("journal") >= 0) continue;
      modules.splice(at, 0, "journal");
      w.set("modules", modules);
      w.set("updatedAt", now);
      app.save(w);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    // 4. back: the Journal leaves the Workspaces.
    for (const w of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      const modules = readModules(w);
      const at = modules.indexOf("journal");
      if (at < 0) continue;
      modules.splice(at, 1);
      w.set("modules", modules);
      w.set("updatedAt", now);
      app.save(w);
    }
    // 3. back: Quotes that were Clippings are Clippings again; the Sources made for them go.
    for (const q of app.findRecordsByFilter("documents", 'type = "quote"', "", 0, 0)) {
      const f = readFields(q);
      if (!f.clipping) continue;
      q.set("type", "clipping");
      q.set("folder", movedFolder(q.getString("folder"), "Quotes", "Clippings"));
      q.set("fields", f.clipping);
      q.set("updatedAt", now);
      app.save(q);
    }
    for (const s of app.findRecordsByFilter("documents", 'type = "source"', "", 0, 0)) {
      if (readFields(s).madeFrom === "clipping") app.delete(s);
    }
    // 2. back: a Quote's passage returns to `fields.text`, its Source to `mediaId`.
    for (const q of app.findRecordsByFilter("documents", 'type = "quote"', "", 0, 0)) {
      const f = readFields(q);
      f.text = q.getString("body").trim();
      if (f.source !== undefined) {
        f.mediaId = f.source;
        delete f.source;
      }
      q.set("fields", f);
      q.set("body", "");
      if (q.getString("folder") === "Quotes") q.set("folder", "");
      q.set("updatedAt", now);
      app.save(q);
    }
    // 1. back: Windows are `source` again. A Source made by hand since would
    // collide, so it is set aside under a type nothing reads — kept, not lost.
    for (const s of app.findRecordsByFilter("documents", 'type = "source"', "", 0, 0)) {
      s.set("type", "source_set_aside");
      s.set("updatedAt", now);
      app.save(s);
    }
    for (const r of app.findRecordsByFilter("documents", 'type = "window"', "", 0, 0)) {
      r.set("type", "source");
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const v of app.findRecordsByFilter("views", 'type = "window"', "", 0, 0)) {
      v.set("type", "source");
      v.set("updatedAt", now);
      app.save(v);
    }
  },
);
