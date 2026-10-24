/// <reference path="../pb_data/types.d.ts" />

// #263: what the MCP server needs a superuser for, without one.
//
// - At each start, the one `mcp_service` record (1759500000) is made to match
//   the MCP_SERVICE_EMAIL / MCP_SERVICE_PASSWORD secrets, so rotating it is
//   changing the secret on both apps. Without them nothing is touched.
// - POST /api/lifeline/mcp/impersonate/{id} {"seconds": n}: a token acting as
//   that Account, for n seconds (at most a day), as PocketBase's own
//   impersonate gives a superuser. Only the service record or a superuser
//   may call it.

// On serve, not onBootstrap: the migrations have run by then (JSVM has no
// onServe of its own, so it binds to the app hook).
$app.onServe().bindFunc((e) => {
  const email = $os.getenv("MCP_SERVICE_EMAIL");
  const password = $os.getenv("MCP_SERVICE_PASSWORD");
  if (email && password) {
    try {
      const collection = $app.findCollectionByNameOrId("mcp_service");
      let record = null;
      // One service record: an old one under another email goes with the rotation.
      for (const r of $app.findAllRecords("mcp_service")) {
        if (!record && r.email() === email) record = r;
        else $app.delete(r);
      }
      if (!record) {
        record = new Record(collection);
        record.setEmail(email);
        record.setVerified(true);
      }
      if (!record.validatePassword(password)) record.setPassword(password);
      $app.save(record);
    } catch (err) {
      // Never keep PocketBase from serving: the MCP server is what fails, and says so.
      $app.logger().error("mcp_service: could not keep the service record", "error", String(err));
    }
  }
  return e.next();
});

routerAdd(
  "POST",
  "/api/lifeline/mcp/impersonate/{id}",
  (e) => {
    const MAX_SECONDS = 24 * 60 * 60;
    const auth = e.auth;
    if (!e.hasSuperuserAuth() && !(auth && auth.collection().name === "mcp_service")) return e.json(403, { error: "forbidden" });
    const body = e.requestInfo().body || {};
    const seconds = Math.floor(Number(body.seconds));
    if (!(seconds > 0 && seconds <= MAX_SECONDS)) return e.json(400, { error: `seconds must be 1–${MAX_SECONDS}` });
    let user;
    try {
      user = $app.findRecordById("users", e.request.pathValue("id"));
    } catch (_) {
      return e.json(404, { error: "no such account" });
    }
    // time.Duration counts nanoseconds.
    const token = user.newStaticAuthToken(seconds * 1e9);
    return e.json(200, { token, record: { id: user.id, email: user.email(), collectionId: user.collection().id, collectionName: "users" } });
  },
  $apis.requireAuth(),
);
