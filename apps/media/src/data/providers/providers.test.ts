import { describe, expect, it } from "vitest";
import { mapTmdbMovie, mapTmdbMovieDetail, mapTmdbTv, mapTmdbTvDetail } from "./tmdb";
import { mapRawgGame, mapRawgGameDetail } from "./rawg";
import { mapGbVolume } from "./googlebooks";
import { mapCvVolume } from "./comicvine";

describe("tmdb mapping", () => {
  it("maps a movie search result (no creator until resolved)", () => {
    expect(mapTmdbMovie({ id: 949, title: "Heat", release_date: "1995-12-15", poster_path: "/heat.jpg" })).toEqual({
      externalKey: "tmdb:movie/949",
      title: "Heat",
      creator: "",
      year: 1995,
      size: 0,
      coverUrl: "https://image.tmdb.org/t/p/w342/heat.jpg",
    });
    expect(mapTmdbMovie({ id: 1, title: "X", poster_path: null })).toMatchObject({ year: 0, coverUrl: "" });
  });
  it("maps a tv result", () => {
    expect(mapTmdbTv({ id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/bb.jpg" })).toMatchObject({ externalKey: "tmdb:tv/1396", title: "Breaking Bad", year: 2008, coverUrl: "https://image.tmdb.org/t/p/w342/bb.jpg" });
  });
  it("resolves director and runtime / episode count", () => {
    expect(mapTmdbMovieDetail({ runtime: 170 }, { crew: [{ job: "Producer", name: "A" }, { job: "Director", name: "Michael Mann" }, { job: "Director", name: "B" }] })).toEqual({ creator: "Michael Mann", size: 170 });
    expect(mapTmdbMovieDetail({ runtime: null }, {})).toEqual({ creator: "", size: 0 });
    expect(mapTmdbTvDetail({ number_of_episodes: 62 })).toEqual({ size: 62 });
  });
});

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

describe("google books mapping", () => {
  it("maps a volume, upgrading the thumbnail to https", () => {
    expect(
      mapGbVolume({ id: "abc", volumeInfo: { title: "Dune", authors: ["Frank Herbert", "X"], publishedDate: "1965-08", pageCount: 412, imageLinks: { thumbnail: "http://books.google.com/thumb?id=abc" } } }),
    ).toEqual({ externalKey: "googlebooks:abc", title: "Dune", creator: "Frank Herbert", year: 1965, size: 412, coverUrl: "https://books.google.com/thumb?id=abc" });
    expect(mapGbVolume({ id: "z" })).toMatchObject({ title: "", creator: "", year: 0, size: 0, coverUrl: "" });
  });
});

describe("comicvine mapping", () => {
  it("maps a volume", () => {
    expect(mapCvVolume({ id: 18166, name: "Saga", start_year: "2012", count_of_issues: 66, publisher: { name: "Image" }, image: { medium_url: "https://cv/saga.jpg" } })).toEqual({
      externalKey: "comicvine:volume/18166",
      title: "Saga",
      creator: "Image",
      year: 2012,
      size: 66,
      coverUrl: "https://cv/saga.jpg",
    });
    expect(mapCvVolume({ id: 1, name: "X", start_year: null, publisher: null, image: null })).toMatchObject({ creator: "", year: 0, size: 0, coverUrl: "" });
  });
});
