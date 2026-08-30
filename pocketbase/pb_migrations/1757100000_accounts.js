/// <reference path="../pb_data/types.d.ts" />

// ADR 0039: Accounts. Every synced collection gets an `owner` relation to
// `users`, stamped by the server (pb_hooks/owner.pb.js) and never sent by the
// client; every rule narrows reads and writes to the caller's own rows.
// Rows that exist today go to the oldest account — the one that was alone
// before a second was made. Signup closes: a superuser makes accounts.

const COLLECTIONS = ["documents", "placements", "screens", "views", "document_types", "attachments"];
const OWN_RULE = "owner = @request.auth.id";
const AUTH_RULE = '@request.auth.id != ""';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const oldest = app.findRecordsByFilter("users", "id != ''", "created", 1, 0);
    const ownerId = oldest.length && oldest[0] ? oldest[0].id : "";

    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.add(
        new RelationField({
          id: name + "_owner",
          name: "owner",
          collectionId: users.id,
          cascadeDelete: true,
          minSelect: 0,
          maxSelect: 1,
          required: true,
          presentable: false,
          hidden: false,
          system: false,
        }),
      );
      c.indexes.push(`CREATE INDEX idx_${name}_owner ON ${name} (owner)`);
      c.listRule = OWN_RULE;
      c.viewRule = OWN_RULE;
      c.updateRule = OWN_RULE;
      c.deleteRule = OWN_RULE;
      c.createRule = AUTH_RULE;
      app.save(c);
      // Raw SQL so `updated` stays put: no device re-pulls everything it already has.
      if (ownerId) {
        app.db().newQuery(`UPDATE ${name} SET owner = {:o} WHERE owner = '' OR owner IS NULL`).bind({ o: ownerId }).execute();
      }
    }

    users.createRule = null;
    app.save(users);
  },
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.fields.removeByName("owner");
      c.indexes = c.indexes.filter((i) => !i.includes(`idx_${name}_owner`));
      c.listRule = AUTH_RULE;
      c.viewRule = AUTH_RULE;
      c.updateRule = AUTH_RULE;
      c.deleteRule = AUTH_RULE;
      c.createRule = AUTH_RULE;
      app.save(c);
    }
    const users = app.findCollectionByNameOrId("users");
    users.createRule = "";
    app.save(users);
  },
);
