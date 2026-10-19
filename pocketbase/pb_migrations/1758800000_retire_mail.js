/// <reference path="../pb_data/types.d.ts" />

// ADR 0080: the Mail App is retired. What it left on the server goes:
//
// - every `mailbox` Document is tombstoned (deleted = 1, so every device drops
//   it on its next pull), marked `fields.retiredMail` so the down step can
//   bring it back. A Mailbox held only an address; nothing at Google changes.
// - Views and type overrides of the `mailbox` type, and any Placement Mail
//   owned, are tombstoned the same way.
// - Mail's Cards (`mail.*`) leave every Screen layout and every Workspace's
//   Overview arrangements; the rest of each arrangement is kept as it was.
// - The Mail Module leaves every Workspace's Module list, its Phone bar slot
//   empties (positions kept: a slot is never closed up, ADR 0053), and capture
//   pins to Mail's Commands go.
//
// Only rows that named Mail are saved, with a fresh `updatedAt` so the change
// wins last-writer-wins on every device. The down step restores the Mailboxes
// only; removed Views, Cards, slots and pins are not put back.

const APP = "mail";
const TYPE = "mailbox";

function readJson(r, key, fallback) {
  try {
    const v = JSON.parse(r.getString(key) || "null");
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

const isMailCard = (item) => !!item && typeof item.cardId === "string" && item.cardId.startsWith(APP + ".");
const isMailPin = (pin) => typeof pin === "string" && pin.startsWith(APP + "/");
const isMailSlot = (slot) =>
  !!slot && ((slot.kind === "module" && slot.id === APP) || (slot.kind === "appScreen" && typeof slot.id === "string" && (slot.id === APP || slot.id.startsWith(APP + ".") || slot.id.startsWith(APP + "/"))));

function tombstone(app, collection, filter, now) {
  for (const r of app.findRecordsByFilter(collection, filter, "", 0, 0)) {
    if (r.getInt("deleted")) continue;
    if (collection === "documents") {
      const fields = readJson(r, "fields", {});
      fields.retiredMail = true;
      r.set("fields", fields);
    }
    r.set("deleted", 1);
    r.set("updatedAt", now);
    app.save(r);
  }
}

migrate(
  (app) => {
    const now = new Date().toISOString();

    tombstone(app, "documents", `type = "${TYPE}"`, now);
    tombstone(app, "views", `type = "${TYPE}"`, now);
    tombstone(app, "document_types", `typeId = "${TYPE}"`, now);
    tombstone(app, "placements", `appId = "${APP}"`, now);

    for (const r of app.findRecordsByFilter("screens", "id != ''", "", 0, 0)) {
      const layout = readJson(r, "layout", []);
      if (!Array.isArray(layout) || !layout.some(isMailCard)) continue;
      r.set("layout", layout.filter((item) => !isMailCard(item)));
      r.set("updatedAt", now);
      app.save(r);
    }

    for (const r of app.findRecordsByFilter("workspaces", "id != ''", "", 0, 0)) {
      let changed = false;

      const modules = readJson(r, "modules", []);
      if (Array.isArray(modules) && modules.includes(APP)) {
        r.set("modules", modules.filter((m) => m !== APP));
        changed = true;
      }

      const bar = readJson(r, "bar", null);
      if (Array.isArray(bar) && bar.some(isMailSlot)) {
        r.set("bar", bar.map((slot) => (isMailSlot(slot) ? null : slot)));
        changed = true;
      }

      const pins = readJson(r, "capturePins", null);
      if (Array.isArray(pins) && pins.some(isMailPin)) {
        r.set("capturePins", pins.filter((p) => !isMailPin(p)));
        changed = true;
      }

      const overviews = readJson(r, "overviews", null);
      if (overviews && typeof overviews === "object" && !Array.isArray(overviews)) {
        const next = {};
        let touched = false;
        for (const moduleId of Object.keys(overviews)) {
          const items = overviews[moduleId];
          if (moduleId === APP) {
            touched = true;
            continue;
          }
          if (Array.isArray(items) && items.some(isMailCard)) {
            next[moduleId] = items.filter((item) => !isMailCard(item));
            touched = true;
          } else {
            next[moduleId] = items;
          }
        }
        if (touched) {
          r.set("overviews", next);
          changed = true;
        }
      }

      if (!changed) continue;
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", `type = "${TYPE}"`, "", 0, 0)) {
      const fields = readJson(r, "fields", {});
      if (!fields.retiredMail) continue;
      delete fields.retiredMail;
      r.set("fields", fields);
      r.set("deleted", 0);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
);
