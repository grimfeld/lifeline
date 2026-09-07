/// <reference path="../pb_data/types.d.ts" />

// ADR 0047/0048: Workspaces. A new synced collection, plus the two fields the
// partition and the Screen ownership need.
//
//  - `documents.workspace` — "" for shared, else the id of the one separated
//    Workspace that holds the Document (ADR 0048). Every existing Document
//    becomes shared, which is what makes the upgrade invisible.
//  - `screens.workspace` — the Workspace a Screen belongs to (ADR 0047), and
//    `screens.module` for the Module it claims (ADR 0049).
//
// Every existing Account gets one Workspace, "Personal", unseparated, holding
// every Module, owning all of that Account's Screens. Doing the backfill here
// rather than on the client is deliberate: a client-side "create one if none
// exist" races itself across devices and would leave two Personals behind.
//
// The new collection must appear in three places or it is broken in a way that
// is hard to see (ADR 0039): here, in `pb_hooks/owner.pb.js`, and in its own
// rules below. A synced collection without `owner` is visible to every Account.

const MODULES = ["house", "tasks", "schedules", "culture", "money", "notes", "progress"];
const OWN_RULE = "owner = @request.auth.id";
const AUTH_RULE = '@request.auth.id != ""';
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function newId() {
  let out = "";
  for (let i = 0; i < 15; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // --- the collection ---
    const ws = new Collection({
      type: "base",
      name: "workspaces",
      listRule: OWN_RULE,
      viewRule: OWN_RULE,
      updateRule: OWN_RULE,
      deleteRule: OWN_RULE,
      createRule: AUTH_RULE,
    });
    ws.fields.add(new TextField({ name: "id", required: true, primaryKey: true, system: true, min: 15, max: 15, pattern: "^[a-z0-9]+$" }));
    // The LWW clock and the tombstone every synced record carries.
    ws.fields.add(new TextField({ name: "updatedAt", required: true }));
    ws.fields.add(new NumberField({ name: "deleted", onlyInt: true }));
    ws.fields.add(new TextField({ name: "name", required: true }));
    ws.fields.add(new JSONField({ name: "modules", maxSize: 2000 }));
    ws.fields.add(new BoolField({ name: "separated" }));
    ws.fields.add(new NumberField({ name: "sort", onlyInt: true }));
    ws.fields.add(
      new RelationField({
        id: "workspaces_owner",
        name: "owner",
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 0,
        maxSelect: 1,
        required: true,
      }),
    );
    // The server autodates every other synced collection carries. `updated` is
    // not decoration: the sync engine sorts and pages every pull on it, so a
    // collection without it 400s on every cycle ("invalid sort field").
    // Repaired on already-migrated servers by 1757500000.
    ws.fields.add(new AutodateField({ id: "workspaces_created", name: "created", onCreate: true, onUpdate: false }));
    ws.fields.add(new AutodateField({ id: "workspaces_updated", name: "updated", onCreate: true, onUpdate: true }));
    ws.indexes = ["CREATE INDEX idx_workspaces_owner ON workspaces (owner)"];
    app.save(ws);

    // --- the fields the partition needs ---
    const docs = app.findCollectionByNameOrId("documents");
    docs.fields.add(new TextField({ name: "workspace" }));
    docs.indexes.push("CREATE INDEX idx_documents_workspace ON documents (workspace)");
    app.save(docs);

    const screens = app.findCollectionByNameOrId("screens");
    screens.fields.add(new TextField({ name: "workspace" }));
    screens.fields.add(new TextField({ name: "module" }));
    app.save(screens);

    // An Attachment follows the Document that embeds it (ADR 0048). Bodies
    // embed by name and names are unique per Account, so without this a held
    // note resolves another Workspace's image through a sealed boundary.
    const attachments = app.findCollectionByNameOrId("attachments");
    attachments.fields.add(new TextField({ name: "workspace" }));
    app.save(attachments);

    // Existing Documents are shared. Raw SQL so `updated` stays put and no
    // device re-pulls everything it already has (ADR 0039's bargain).
    app.db().newQuery("UPDATE documents SET workspace = '' WHERE workspace IS NULL").execute();
    app.db().newQuery("UPDATE attachments SET workspace = '' WHERE workspace IS NULL").execute();

    // --- one Workspace per Account, owning that Account's Screens ---
    const now = new Date().toISOString();
    for (const user of app.findRecordsByFilter("users", "id != ''", "created", 0, 0)) {
      const existing = app.findRecordsByFilter("workspaces", "owner = {:o}", "", 1, 0, { o: user.id });
      if (existing.length) continue;
      const rec = new Record(ws);
      rec.set("id", newId());
      rec.set("updatedAt", now);
      rec.set("deleted", 0);
      rec.set("name", "Personal");
      rec.set("modules", MODULES);
      rec.set("separated", false);
      rec.set("sort", 0);
      rec.set("owner", user.id);
      app.save(rec);
      app
        .db()
        .newQuery("UPDATE screens SET workspace = {:w} WHERE owner = {:o} AND (workspace IS NULL OR workspace = '')")
        .bind({ w: rec.id, o: user.id })
        .execute();
    }
  },
  (app) => {
    const docs = app.findCollectionByNameOrId("documents");
    docs.fields.removeByName("workspace");
    docs.indexes = docs.indexes.filter((i) => !i.includes("idx_documents_workspace"));
    app.save(docs);

    const screens = app.findCollectionByNameOrId("screens");
    screens.fields.removeByName("workspace");
    screens.fields.removeByName("module");
    app.save(screens);

    const attachments = app.findCollectionByNameOrId("attachments");
    attachments.fields.removeByName("workspace");
    app.save(attachments);

    app.delete(app.findCollectionByNameOrId("workspaces"));
  },
);
