/// <reference path="../pb_data/types.d.ts" />

// ADR 0039 follow-up: `owner = @request.auth.id` alone lets an anonymous
// request (auth id "") match a row whose owner is empty — none should exist
// (the field is required), but the rule must not depend on that. Every rule
// now demands a signed-in user first.

const COLLECTIONS = ["documents", "placements", "screens", "views", "document_types", "attachments"];
const OWN_RULE = '@request.auth.id != "" && owner = @request.auth.id';
const OLD_RULE = "owner = @request.auth.id";

migrate(
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = OWN_RULE;
      c.viewRule = OWN_RULE;
      c.updateRule = OWN_RULE;
      c.deleteRule = OWN_RULE;
      app.save(c);
    }
  },
  (app) => {
    for (const name of COLLECTIONS) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = OLD_RULE;
      c.viewRule = OLD_RULE;
      c.updateRule = OLD_RULE;
      c.deleteRule = OLD_RULE;
      app.save(c);
    }
  },
);
