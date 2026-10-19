/// <reference path="../pb_data/types.d.ts" />

// ADR 0084: a Prices Product's Measure is a dimension read in a chosen unit.
// The old `measure` (kg | l | piece) becomes `dimension` + `unit` + an empty
// `countName`: kg → mass/kg, l → volume/L, piece → count/pc. Amounts on Lines
// were already in kg, L and pieces — the new base units — so no Line is
// touched. The app still reads an old row the same way until it syncs.

function readJson(r, key, fallback) {
  try {
    const v = JSON.parse(r.getString(key) || "null");
    return v === null ? fallback : v;
  } catch (_) {
    return fallback;
  }
}

const FORWARD = {
  kg: { dimension: "mass", unit: "kg" },
  l: { dimension: "volume", unit: "L" },
  piece: { dimension: "count", unit: "pc" },
};

// Back: the base unit of each dimension is all the old shape could say;
// length had no old measure, so it reads as pieces.
const BACK = { mass: "kg", volume: "l", count: "piece", length: "piece" };

migrate(
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "price_product"', "", 0, 0)) {
      const fields = readJson(r, "fields", {});
      if (typeof fields.dimension === "string" && fields.measure === undefined) continue; // already new
      const to = FORWARD[fields.measure] || FORWARD.piece;
      fields.dimension = to.dimension;
      fields.unit = to.unit;
      if (typeof fields.countName !== "string") fields.countName = "";
      delete fields.measure;
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "price_product"', "", 0, 0)) {
      const fields = readJson(r, "fields", {});
      if (fields.dimension === undefined) continue;
      fields.measure = BACK[fields.dimension] || "piece";
      delete fields.dimension;
      delete fields.unit;
      delete fields.countName;
      r.set("fields", fields);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
);
