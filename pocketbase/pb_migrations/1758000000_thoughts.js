/// <reference path="../pb_data/types.d.ts" />

// ADR 0068: what was a plain `note` — my own thinking, with no Source — is a
// Thought now, owned by the Thoughts App, and `note` is freed for the Notes
// App's Note on a Source. Every `note` Document becomes a `thought` (same id,
// so every link and backlink survives); one filed in the old `Notes` home
// Folder moves to `Thoughts`, a topic Folder (`People/Paul`) is the user's own
// and stays. Saved Base Views of `note` follow the type. Every Workspace that
// took Note-taking also takes the new Thoughts Module, so nothing disappears
// from a Rail. `updatedAt` is bumped so LWW clients accept the rows on pull.

const FROM = "note";
const TO = "thought";

function movedFolder(folder) {
  if (folder === "Notes") return "Thoughts";
  if (folder.indexOf("Notes/") === 0) return "Thoughts" + folder.slice("Notes".length);
  return folder;
}

function readModules(r) {
  try {
    const v = JSON.parse(r.getString("modules") || "[]");
    return Array.isArray(v) ? v : [];
  } catch (_) {
    return [];
  }
}

migrate(
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", `type = "${FROM}"`, "", 0, 0)) {
      r.set("type", TO);
      r.set("folder", movedFolder(r.getString("folder")));
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const v of app.findRecordsByFilter("views", `type = "${FROM}"`, "", 0, 0)) {
      v.set("type", TO);
      v.set("updatedAt", now);
      app.save(v);
    }
    for (const w of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      const modules = readModules(w);
      if (modules.indexOf("notes") < 0 || modules.indexOf("thoughts") >= 0) continue;
      modules.splice(modules.indexOf("notes") + 1, 0, "thoughts");
      w.set("modules", modules);
      w.set("updatedAt", now);
      app.save(w);
    }
  },
  (app) => {
    // Back: every Thought is a note again, in `Notes` if it sat in `Thoughts`.
    // Thoughts made after the migration go back too — there is nowhere else
    // for them — and the Thoughts Module leaves the Workspaces.
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", `type = "${TO}"`, "", 0, 0)) {
      const folder = r.getString("folder");
      r.set("type", FROM);
      if (folder === "Thoughts" || folder.indexOf("Thoughts/") === 0) r.set("folder", "Notes" + folder.slice("Thoughts".length));
      r.set("updatedAt", now);
      app.save(r);
    }
    for (const v of app.findRecordsByFilter("views", `type = "${TO}"`, "", 0, 0)) {
      v.set("type", FROM);
      v.set("updatedAt", now);
      app.save(v);
    }
    for (const w of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      const modules = readModules(w);
      const at = modules.indexOf("thoughts");
      if (at < 0) continue;
      modules.splice(at, 1);
      w.set("modules", modules);
      w.set("updatedAt", now);
      app.save(w);
    }
  },
);
