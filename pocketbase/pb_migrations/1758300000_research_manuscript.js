/// <reference path="../pb_data/types.d.ts" />

// ADR 0068: the Writing retires into the Essay (Research) and the Manuscript.
// Every `writing` becomes an `essay` of the same id — links, Versions and
// backlinks hold — and moves from `Writings/…` to `Essays/…`. A Talk was a
// Writing filed under `Writings/Talks`; it is an Essay with the `talk` Tag now
// (CONTEXT.md "Talk"), so those get the Tag as they move. Saved Base Views
// follow the type. Every Workspace that took the Journal or Notes also takes
// Research and Manuscript. Manuscripts start empty: nothing was one before.

function readJson(r, key, fallback) {
  try {
    const v = JSON.parse(r.getString(key) || "null");
    return v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

function movedFolder(folder, from, to) {
  if (folder === from) return to;
  if (folder.indexOf(from + "/") === 0) return to + folder.slice(from.length);
  return folder;
}

const isTalkFolder = (f) => f === "Writings/Talks" || f.indexOf("Writings/Talks/") === 0;

migrate(
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "writing"', "", 0, 0)) {
      const folder = r.getString("folder");
      const tags = readJson(r, "tags", []);
      const fields = readJson(r, "fields", {});
      if (isTalkFolder(folder) && tags.indexOf("talk") < 0) {
        tags.push("talk");
        fields.wasTalkFolder = true;
      }
      if (!Array.isArray(fields.material)) fields.material = [];
      r.set("type", "essay");
      r.set("folder", movedFolder(folder, "Writings", "Essays"));
      r.set("tags", tags);
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const v of app.findRecordsByFilter("views", 'type = "writing"', "", 0, 0)) {
      v.set("type", "essay");
      v.set("updatedAt", now);
      app.save(v);
    }
    for (const w of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      const modules = readJson(w, "modules", []);
      const at = Math.max(modules.indexOf("journal"), modules.indexOf("notes"));
      if (at < 0) continue;
      let changed = false;
      let pos = at + 1;
      for (const m of ["research", "manuscript"]) {
        if (modules.indexOf(m) >= 0) continue;
        modules.splice(pos++, 0, m);
        changed = true;
      }
      if (!changed) continue;
      w.set("modules", modules);
      w.set("updatedAt", now);
      app.save(w);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "essay"', "", 0, 0)) {
      const fields = readJson(r, "fields", {});
      let tags = readJson(r, "tags", []);
      if (fields.wasTalkFolder) tags = tags.filter((t) => t !== "talk");
      delete fields.wasTalkFolder;
      delete fields.material;
      r.set("type", "writing");
      r.set("folder", movedFolder(r.getString("folder"), "Essays", "Writings"));
      r.set("tags", tags);
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const v of app.findRecordsByFilter("views", 'type = "essay"', "", 0, 0)) {
      v.set("type", "writing");
      v.set("updatedAt", now);
      app.save(v);
    }
    for (const w of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      const modules = readJson(w, "modules", []).filter((m) => m !== "research" && m !== "manuscript");
      w.set("modules", modules);
      w.set("updatedAt", now);
      app.save(w);
    }
  },
);
