/// <reference path="../pb_data/types.d.ts" />

// Repair for 1757400000: the `workspaces` collection was created without the
// `created`/`updated` autodate fields every other synced collection carries.
//
// `updated` is load-bearing, not decoration. The sync engine pulls each
// collection with `sort=updated` and pages on it, so a collection lacking it
// fails every cycle with `invalid sort field "updated"` (400). Two consequences
// followed from the one omission: Workspaces never synced between devices, and
// — because a cycle only records `sync:pulledOnce` when *every* collection
// pulled cleanly — the fresh-account bootstrap that waits on that flag never
// fired either.
//
// 1757400000 is fixed too, so a fresh server builds the collection correctly;
// this migration repairs the servers that already ran it, and no-ops where the
// fields are present.

migrate(
  (app) => {
    const ws = app.findCollectionByNameOrId("workspaces");
    if (!ws.fields.getByName("created")) {
      ws.fields.add(new AutodateField({ id: "workspaces_created", name: "created", onCreate: true, onUpdate: false }));
    }
    if (!ws.fields.getByName("updated")) {
      ws.fields.add(new AutodateField({ id: "workspaces_updated", name: "updated", onCreate: true, onUpdate: true }));
    }
    app.save(ws);

    // Rows created before the fields existed have no value for them, so they
    // would sort ahead of everything and never come back on an incremental
    // pull. Stamp them once, by raw SQL so nothing else is disturbed.
    const now = new Date().toISOString().replace("T", " ").replace("Z", "Z");
    app.db().newQuery("UPDATE workspaces SET created = {:t} WHERE created IS NULL OR created = ''").bind({ t: now }).execute();
    app.db().newQuery("UPDATE workspaces SET updated = {:t} WHERE updated IS NULL OR updated = ''").bind({ t: now }).execute();
  },
  (app) => {
    const ws = app.findCollectionByNameOrId("workspaces");
    ws.fields.removeByName("created");
    ws.fields.removeByName("updated");
    app.save(ws);
  },
);
