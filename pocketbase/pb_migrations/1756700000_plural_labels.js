/// <reference path="../pb_data/types.d.ts" />

// The one stored name of a user-defined type is now the PLURAL (singular is
// derived by dropping the trailing "s"). Existing labels were singular:
// append an "s" where one isn't already there, and bump updatedAt so
// clients re-pull.

migrate(
  (app) => {
    const rows = app.findAllRecords("document_types");
    const now = new Date().toISOString();
    for (const r of rows) {
      const label = r.getString("label");
      if (!label || /s$/i.test(label)) continue;
      r.set("label", label + "s");
      r.set("updatedAt", now);
      app.save(r);
    }
  },
  (app) => {
    // Down: strip the trailing "s" back off (best effort).
    const rows = app.findAllRecords("document_types");
    for (const r of rows) {
      const label = r.getString("label");
      if (/[a-rt-z]s$/i.test(label)) r.set("label", label.slice(0, -1));
      app.save(r);
    }
  },
);
