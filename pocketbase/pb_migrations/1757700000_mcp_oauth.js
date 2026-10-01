/// <reference path="../pb_data/types.d.ts" />

// ADR 0062: the MCP server is its own OAuth authorization server, and keeps
// what it must remember here — the clients that registered themselves
// (Claude on the web, Claude Code…) and one grant per connected client per
// Account. Neither is synced and neither belongs to a device: every rule is
// null, so only a superuser (the MCP server) reads or writes them, and the
// owner hook does not apply. Deleting a grant row disconnects that client.
//
// Tokens are never stored, only their SHA-256: a leaked database row cannot be
// replayed.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    const clients = new Collection({ type: "base", name: "mcp_clients" });
    clients.fields.add(new TextField({ name: "client_id", required: true }));
    // The registration as the client sent it (RFC 7591), plus what the server assigned.
    clients.fields.add(new JSONField({ name: "info", required: true, maxSize: 20000 }));
    clients.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    clients.addIndex("idx_mcp_clients_client_id", true, "client_id", "");
    app.save(clients);

    const grants = new Collection({ type: "base", name: "mcp_grants" });
    grants.fields.add(new RelationField({ name: "user", collectionId: users.id, cascadeDelete: true, maxSelect: 1, required: true }));
    grants.fields.add(new TextField({ name: "client_id", required: true }));
    grants.fields.add(new TextField({ name: "client_name" }));
    // Space-separated OAuth scopes: lifeline:read, lifeline:write.
    grants.fields.add(new TextField({ name: "scopes", required: true }));
    grants.fields.add(new TextField({ name: "access_hash", required: true }));
    grants.fields.add(new DateField({ name: "access_expires", required: true }));
    grants.fields.add(new TextField({ name: "refresh_hash", required: true }));
    grants.fields.add(new DateField({ name: "refresh_expires", required: true }));
    grants.fields.add(new TextField({ name: "resource" }));
    grants.fields.add(new DateField({ name: "last_used" }));
    grants.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
    grants.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
    grants.addIndex("idx_mcp_grants_access", true, "access_hash", "");
    grants.addIndex("idx_mcp_grants_refresh", true, "refresh_hash", "");
    app.save(grants);
  },
  (app) => {
    for (const name of ["mcp_grants", "mcp_clients"]) {
      try {
        app.delete(app.findCollectionByNameOrId(name));
      } catch {
        /* already gone */
      }
    }
  },
);
