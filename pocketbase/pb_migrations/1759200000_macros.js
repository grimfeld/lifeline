/// <reference path="../pb_data/types.d.ts" />

// ADR 0092: Macros — a user-made Command whose steps are other Commands.
// Synced, global Core bookkeeping like `views`: one Macro serves every
// Workspace, so there is no `workspace` field.
//
// A synced collection appears in four places (ADR 0039, 1757400000): here, its
// owner rules below, `pb_hooks/owner.pb.js` (both lists), and its own
// `(owner, updated)` pull index (1758700000).

const OWN_RULE = '@request.auth.id != "" && owner = @request.auth.id';
const AUTH_RULE = '@request.auth.id != ""';

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    const c = new Collection({
      type: "base",
      name: "macros",
      listRule: OWN_RULE,
      viewRule: OWN_RULE,
      updateRule: OWN_RULE,
      deleteRule: OWN_RULE,
      createRule: AUTH_RULE,
    });
    c.fields.add(new TextField({ name: "id", required: true, primaryKey: true, system: true, min: 15, max: 15, pattern: "^[a-z0-9]+$" }));
    // The LWW clock and the tombstone every synced record carries.
    c.fields.add(new TextField({ name: "updatedAt", required: true }));
    c.fields.add(new NumberField({ name: "deleted", onlyInt: true }));
    c.fields.add(new TextField({ name: "name", required: true }));
    // Ordered steps: { command: "appId/commandId", args: { key: { from, … } } }.
    c.fields.add(new JSONField({ name: "steps", maxSize: 200000 }));
    c.fields.add(new NumberField({ name: "sort", onlyInt: true }));
    c.fields.add(
      new RelationField({
        id: "macros_owner",
        name: "owner",
        collectionId: users.id,
        cascadeDelete: true,
        minSelect: 0,
        maxSelect: 1,
        required: true,
      }),
    );
    // The sync engine sorts and pages every pull on `updated` (1757500000).
    c.fields.add(new AutodateField({ id: "macros_created", name: "created", onCreate: true, onUpdate: false }));
    c.fields.add(new AutodateField({ id: "macros_updated", name: "updated", onCreate: true, onUpdate: true }));
    c.indexes = ["CREATE INDEX idx_macros_owner ON macros (owner)", "CREATE INDEX idx_macros_owner_updated ON macros (owner, updated)"];
    app.save(c);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("macros"));
  },
);
