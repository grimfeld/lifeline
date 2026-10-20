/// <reference path="../pb_data/types.d.ts" />

// ADR 0090: midnight is stored one way. A timed Event or a one-off Time
// blocker that ended at "24:00" now ends at "00:00" on the next day — the day
// after its end day, or after its own day when it had none. The rewritten row
// keeps what it was in `fields.endedAt2400` (its old end day, "" for none) so
// the down step can put it back. Weekly blockers are rules, not spans, and are
// left alone. The Calendar App reads an old "24:00" the same way, for stores
// this never reaches (local-only ones).

const MARK = "endedAt2400";

function readFields(r) {
  try {
    return JSON.parse(r.getString("fields") || "{}") || {};
  } catch (_) {
    return {};
  }
}

const isDay = (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d);

function nextDay(d) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

/** A row that is a span (a timed Event, a one-off blocker): it has a day and a start. */
function isSpan(type, f) {
  if (!isDay(f.date) || !f.start) return false;
  return type === "event" || type === "time_blocker";
}

migrate(
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "event" || type = "time_blocker"', "", 0, 0)) {
      const f = readFields(r);
      if (!isSpan(r.getString("type"), f) || f.end !== "24:00") continue;
      const endDay = isDay(f.endDate) && f.endDate > f.date ? f.endDate : f.date;
      f[MARK] = f.endDate || "";
      f.endDate = nextDay(endDay);
      f.end = "00:00";
      r.set("fields", f);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    const now = new Date().toISOString();
    for (const r of app.findRecordsByFilter("documents", 'type = "event" || type = "time_blocker"', "", 0, 0)) {
      const f = readFields(r);
      if (!(MARK in f)) continue;
      const was = f[MARK] || "";
      const endDay = isDay(was) && was > f.date ? was : f.date;
      // Only a span still ending where the up step put it goes back; one retimed since keeps its new end.
      if (f.end === "00:00" && f.endDate === nextDay(endDay)) {
        f.endDate = was || null;
        f.end = "24:00";
      }
      delete f[MARK];
      r.set("fields", f);
      r.set("updatedAt", now);
      app.save(r);
    }
  },
);
