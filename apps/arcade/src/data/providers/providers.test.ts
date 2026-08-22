import { describe, expect, it } from "vitest";
import { mapRawgGame, mapRawgGameDetail } from "./rawg";

describe("rawg mapping", () => {
  it("maps a game and its developers", () => {
    expect(mapRawgGame({ id: 3498, name: "GTA V", released: "2013-09-17", background_image: "https://media.rawg.io/x.jpg", playtime: 73 })).toEqual({
      externalKey: "rawg:3498",
      title: "GTA V",
      creator: "",
      year: 2013,
      size: 73,
      coverUrl: "https://media.rawg.io/x.jpg",
    });
    expect(mapRawgGame({ id: 1, name: "X", released: null, background_image: null, playtime: null })).toMatchObject({ year: 0, size: 0, coverUrl: "" });
    expect(mapRawgGameDetail({ developers: [{ name: "Rockstar North" }, { name: "Rockstar Games" }] })).toEqual({ creator: "Rockstar North, Rockstar Games" });
    expect(mapRawgGameDetail({})).toEqual({ creator: "" });
  });
});
