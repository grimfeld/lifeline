import { describe, expect, it } from "vitest";
import { addToPlaylist, moveInPlaylist, playlistsWith, removeFromPlaylist, worksOf } from "./playlist";
import type { Playlist, Work } from "./types";

function playlist(p: Partial<Playlist>): Playlist {
  return { id: p.id ?? "p", updatedAt: "", deleted: 0, type: "discotheque_playlist", title: "t", tags: [], folder: "", createdAt: "2026-01-01", workIds: [], ranked: false, ...p } as Playlist;
}
function work(id: string): Work {
  return { id, updatedAt: "", deleted: 0, type: "music", title: id, tags: [], folder: "", createdAt: "2026-01-01", creator: "", externalKey: "", coverUrl: "", size: 0, year: 0, engagement: "UNSTARTED", reason: "", addedOn: "2026-01-01", startedOn: "", finishedOn: "", liked: false, rating: 0, partsTracked: false, caughtUpGroup: 0, caughtUpPart: 0 } as Work;
}

describe("playlist membership", () => {
  it("appends once, removes, and moves within bounds", () => {
    expect(addToPlaylist(["a"], "b")).toEqual(["a", "b"]);
    expect(addToPlaylist(["a", "b"], "b")).toEqual(["a", "b"]);
    expect(removeFromPlaylist(["a", "b"], "a")).toEqual(["b"]);
    expect(moveInPlaylist(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveInPlaylist(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveInPlaylist(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveInPlaylist(["a", "b", "c"], "zz", 1)).toEqual(["a", "b", "c"]);
  });

  it("finds the playlists a work sits in, by title", () => {
    const ps = [playlist({ id: "2", title: "Zed", workIds: ["x"] }), playlist({ id: "1", title: "Alpha", workIds: ["x", "y"] }), playlist({ id: "3", title: "None", workIds: [] })];
    expect(playlistsWith(ps, "x").map((p) => p.title)).toEqual(["Alpha", "Zed"]);
    expect(playlistsWith(ps, "y").map((p) => p.title)).toEqual(["Alpha"]);
  });

  it("resolves works in playlist order and skips ids that no longer exist", () => {
    const byId = new Map([["a", work("a")], ["b", work("b")]]);
    expect(worksOf(playlist({ workIds: ["b", "gone", "a"] }), byId).map((w) => w.id)).toEqual(["b", "a"]);
  });
});
