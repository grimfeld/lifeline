/// <reference path="../pb_data/types.d.ts" />

// #258: the admin UI (/_/) and superuser sign-in are not for the internet.
// With PB_ADMIN_PRIVATE=1, a request that came through Fly's public edge (it
// carries Fly-Client-IP) is refused on those paths. `fly proxy 8080 -a
// lifeline-pb` reaches the machine straight, without the edge, so admin work
// goes through it. Off until set: the MCP server signed in as a superuser over
// the public URL until #263's mcp_service secrets were in.

routerUse((e) => {
  if ($os.getenv("PB_ADMIN_PRIVATE") !== "1" || !e.request.header.get("Fly-Client-IP")) return e.next();
  const path = e.request.url.path;
  if (path === "/_" || path.startsWith("/_/")) return e.json(404, { message: "Not found." });
  // By name or by id: a collection route names either.
  const m = path.match(/^\/api\/collections\/([^/]+)/);
  if (m) {
    let name = "";
    try {
      name = $app.findCollectionByNameOrId(m[1]).name;
    } catch (_) {}
    if (name === "_superusers") return e.json(404, { message: "Not found." });
  }
  return e.next();
});
