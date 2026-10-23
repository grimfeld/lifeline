import { describe, expect, it } from "vitest";
import type { Artwork, Exhibition, Room } from "./types";
import { addToRoom, canHang, canReopen, canTakeDown, dailyPick, hang, hungArtworks, moveInRoom, nextRoomOrder, removeFromRoom, reopen, roomsOf, takeDown } from "./rules";

const ex = (id: string, state: Exhibition["state"]): Exhibition => ({ id, type: "exhibition", title: id, state, hungOn: "", archivedOn: "", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: 0 } as unknown as Exhibition);
const room = (id: string, exhibitionId: string, order: number, artworkIds: string[]): Room => ({ id, type: "room", title: id, exhibitionId, order, artworkIds, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: 0 } as unknown as Room);
const art = (id: string): Artwork => ({ id, type: "painting", title: id, artistId: "", year: "", imageUrl: "", location: "", materials: "", dimensions: "", seen: false, externalKey: "", addedOn: "", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: 0 } as unknown as Artwork);

describe("exhibition lifecycle", () => {
  it("hangs from preparation and from the archive, never from hanging", () => {
    expect(canHang("PREP")).toBe(true);
    expect(canHang("ARCHIVED")).toBe(true);
    expect(canHang("HANGING")).toBe(false);
  });
  it("only a hanging show can be taken down; taking down always archives", () => {
    expect(canTakeDown("HANGING")).toBe(true);
    expect(canTakeDown("PREP")).toBe(false);
    expect(canTakeDown("ARCHIVED")).toBe(false);
    expect(takeDown("2026-08-21")).toEqual({ state: "ARCHIVED", archivedOn: "2026-08-21" });
  });
  it("hanging stamps the day and clears a past archive date", () => {
    expect(hang("2026-08-21")).toEqual({ state: "HANGING", hungOn: "2026-08-21", archivedOn: "" });
  });
  it("only an archived show can be reopened, back to preparation", () => {
    expect(canReopen("ARCHIVED")).toBe(true);
    expect(canReopen("HANGING")).toBe(false);
    expect(reopen()).toEqual({ state: "PREP", hungOn: "", archivedOn: "" });
  });
});

describe("rooms", () => {
  it("walks rooms in order, scoped to one exhibition", () => {
    const rooms = [room("b", "e1", 2, []), room("a", "e1", 1, []), room("x", "e2", 1, [])];
    expect(roomsOf(rooms, "e1").map((r) => r.id)).toEqual(["a", "b"]);
  });
  it("appends after the highest order", () => {
    expect(nextRoomOrder([room("a", "e1", 1, []), room("b", "e1", 5, [])])).toBe(6);
    expect(nextRoomOrder([])).toBe(1);
  });
  it("hangs once, removes, and moves within bounds", () => {
    expect(addToRoom(["a"], "b")).toEqual(["a", "b"]);
    expect(addToRoom(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(removeFromRoom(["a", "b"], "a")).toEqual(["b"]);
    expect(moveInRoom(["a", "b", "c"], "c", -1)).toEqual(["a", "c", "b"]);
    expect(moveInRoom(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveInRoom(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });
});

describe("on display", () => {
  it("collects hung artworks with their show and room, deduplicated", () => {
    const shows = [ex("e1", "HANGING"), ex("e2", "HANGING")];
    const rooms = [room("r1", "e1", 1, ["a", "b"]), room("r2", "e2", 1, ["b", "c", "missing"])];
    const works = [art("a"), art("b"), art("c")];
    const hung = hungArtworks(shows, rooms, works);
    expect(hung.map((h) => h.artwork.id)).toEqual(["a", "b", "c"]);
    expect(hung[0]?.room.id).toBe("r1");
    expect(hung[2]?.exhibition.id).toBe("e2");
  });
  it("picks deterministically per day and moves with the date", () => {
    const pool = hungArtworks([ex("e1", "HANGING")], [room("r1", "e1", 1, ["a", "b", "c", "d", "e"])], ["a", "b", "c", "d", "e"].map(art));
    const one = dailyPick(pool, "2026-08-21");
    expect(one).not.toBeNull();
    expect(dailyPick(pool, "2026-08-21")!.artwork.id).toBe(one!.artwork.id);
    const days = ["2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24"].map((d) => dailyPick(pool, d)!.artwork.id);
    expect(new Set(days).size).toBeGreaterThan(1);
    expect(dailyPick([], "2026-08-21")).toBeNull();
  });
});
