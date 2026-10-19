/// <reference path="../pb_data/types.d.ts" />

// ADR 0084: a Receipt marked noticed, not bought, is a Sighting. Before the
// mark existed, "Add price…" saved a shelf price as a one-Line Receipt with no
// printed total; every such live Receipt becomes a Sighting (fields.noticed =
// true), marked `fields.sightingByMigration` so the down step can take back
// only what this step marked. A hand-typed purchase among them is fixed by
// unticking "noticed" in the Receipt dialog.
//
// Only the Receipts it marks are saved, with a fresh `updatedAt` so the change
// wins last-writer-wins on every device. Lines, Products and Shops are untouched.

function readJson(r, key, fallback) {
  try {
    const v = JSON.parse(r.getString(key) || "null");
    return v == null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

migrate(
  (app) => {
    const now = new Date().toISOString();
    const linesPer = {};
    for (const l of app.findRecordsByFilter("documents", 'type = "price_line" && deleted != 1', "", 0, 0)) {
      const receiptId = readJson(l, "fields", {}).receiptId;
      if (typeof receiptId === "string" && receiptId) linesPer[receiptId] = (linesPer[receiptId] || 0) + 1;
    }
    for (const r of app.findRecordsByFilter("documents", 'type = "price_receipt" && deleted != 1', "", 0, 0)) {
      const fields = readJson(r, "fields", {});
      if (fields.noticed === true) continue;
      if (Math.round(Number(fields.total) || 0) > 0) continue;
      if (linesPer[r.id] !== 1) continue;
      fields.noticed = true;
      fields.sightingByMigration = true;
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "price_receipt"', "", 0, 0)) {
      const fields = readJson(r, "fields", {});
      if (!fields.sightingByMigration) continue;
      delete fields.sightingByMigration;
      fields.noticed = false;
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
);
