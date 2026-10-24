/// <reference path="../pb_data/types.d.ts" />

// #263: the MCP server no longer signs in as a superuser. It signs in as the
// one record of `mcp_service`, an auth collection nobody can sign up to or
// list (every rule but auth is null, so only a superuser manages it). The
// OAuth tables (1757700000) open to that record alone, and it mints tokens
// acting as an Account through `mcp_service.pb.js`. The record itself is kept
// from the MCP_SERVICE_EMAIL / MCP_SERVICE_PASSWORD secrets at each boot.

const SERVICE_RULE = '@request.auth.collectionName = "mcp_service"';

migrate(
  (app) => {
    const service = new Collection({
      type: "auth",
      name: "mcp_service",
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      authRule: "",
      manageRule: null,
    });
    service.passwordAuth.enabled = true;
    service.oauth2.enabled = false;
    service.otp.enabled = false;
    app.save(service);

    for (const name of ["mcp_clients", "mcp_grants"]) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = SERVICE_RULE;
      c.viewRule = SERVICE_RULE;
      c.createRule = SERVICE_RULE;
      c.updateRule = SERVICE_RULE;
      c.deleteRule = SERVICE_RULE;
      app.save(c);
    }
  },
  (app) => {
    for (const name of ["mcp_clients", "mcp_grants"]) {
      const c = app.findCollectionByNameOrId(name);
      c.listRule = null;
      c.viewRule = null;
      c.createRule = null;
      c.updateRule = null;
      c.deleteRule = null;
      app.save(c);
    }
    try {
      app.delete(app.findCollectionByNameOrId("mcp_service"));
    } catch {
      /* already gone */
    }
  },
);
