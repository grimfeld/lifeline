/// <reference path="../pb_data/types.d.ts" />

// 1757200000 for `workspaces`: created after that migration hardened every
// owner rule, it came back with the bare `owner = @request.auth.id`, which lets
// an anonymous request (auth id "") match a row with an empty owner. None
// should exist (the field is required), but the rule must not depend on that.

const OWN_RULE = '@request.auth.id != "" && owner = @request.auth.id';
const OLD_RULE = "owner = @request.auth.id";

function setRules(app, rule) {
  const c = app.findCollectionByNameOrId("workspaces");
  c.listRule = rule;
  c.viewRule = rule;
  c.updateRule = rule;
  c.deleteRule = rule;
  app.save(c);
}

migrate(
  (app) => setRules(app, OWN_RULE),
  (app) => setRules(app, OLD_RULE),
);
