/// <reference path="../pb_data/types.d.ts" />

// Last-writer-wins (ADR 0002), kept by the server: an update whose `updatedAt`
// (the client's LWW clock, ISO text) is older than the stored one is refused
// with 409, and the record is left as it is. The client then fetches the newer
// copy, lets the App rescue its losing edit (ADR 0010) and stores the server's.
// Checked here so a push is one request: the client used to read every record
// before updating it, to compare the clocks itself.
//
// Every collection with an `updatedAt` field, for signed-in users only:
// superusers (the admin UI, the MCP server's admin client) are left alone.

onRecordUpdateRequest((e) => {
  if (e.auth && e.auth.collection().name === "users" && e.record.collection().fields.getByName("updatedAt")) {
    const stored = e.record.original().getString("updatedAt");
    const incoming = e.record.getString("updatedAt");
    if (stored && incoming && stored > incoming) {
      throw new ApiError(409, "The server has a newer copy of this record.", {});
    }
  }
  e.next();
});
