/// <reference path="../pb_data/types.d.ts" />

// Key bindings (CONTEXT.md "Key binding"): a synced, global list of
// key → Command, Core bookkeeping like Views. One row per binding:
//  - `key` — the chord, `Mod+Alt+Shift+J` (packages/core/src/keyBindings.ts)
//  - `command` — `appId/commandId`
//
// A new synced collection belongs in three places (ADR 0039): here, with its
// owner rules; `pb_hooks/owner.pb.js`; and the `(owner, updated)` pull index
// (1758700000), created here with it.

const OWN_RULE = '@request.auth.id != "" && owner = @request.auth.id';
const AUTH_RULE = '@request.auth.id != ""';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "key_bindings",
      listRule: OWN_RULE,
      viewRule: OWN_RULE,
      updateRule: OWN_RULE,
      deleteRule: OWN_RULE,
      createRule: AUTH_RULE,
    });
    c.fields.add(new TextField({ name: "id", required: true, primaryKey: true, system: true, min: 15, max: 15, pattern: "^[a-z0-9]+$" }));
    c.fields.add(new TextField({ name: "updatedAt", required: true }));
    c.fields.add(new NumberField({ name: "deleted", onlyInt: true }));
    c.fields.add(new TextField({ name: "key", required: true, max: 60 }));
    c.fields.add(new TextField({ name: "command", required: true, max: 200 }));
    c.fields.add(
      new RelationField({
        id: "key_bindings_owner",
        name: "owner",
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 0,
        maxSelect: 1,
        required: true,
      }),
    );
    // `updated` is what every pull sorts and pages on (see 1757500000).
    c.fields.add(new AutodateField({ id: "key_bindings_created", name: "created", onCreate: true, onUpdate: false }));
    c.fields.add(new AutodateField({ id: "key_bindings_updated", name: "updated", onCreate: true, onUpdate: true }));
    c.indexes = [
      "CREATE INDEX idx_key_bindings_owner ON key_bindings (owner)",
      "CREATE INDEX idx_key_bindings_owner_updated ON key_bindings (owner, updated)",
    ];
    app.save(c);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("key_bindings"));
  },
);
