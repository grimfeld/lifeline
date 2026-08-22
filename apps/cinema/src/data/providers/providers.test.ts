import { describe, expect, it } from "vitest";
import { mapTmdbMovie, mapTmdbMovieDetail, mapTmdbTv, mapTmdbTvDetail } from "./tmdb";

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
  });
  it("maps a tv result and the lazy details", () => {
    expect(mapTmdbTv({ id: 1396, name: "Breaking Bad", first_air_date: "2008-01-20", poster_path: "/bb.jpg" })).toMatchObject({ externalKey: "tmdb:tv/1396", title: "Breaking Bad", year: 2008, coverUrl: "https://image.tmdb.org/t/p/w342/bb.jpg" });
    expect(mapTmdbMovieDetail({ runtime: 170 }, { crew: [{ job: "Director", name: "Michael Mann" }] })).toEqual({ creator: "Michael Mann", size: 170 });
    expect(mapTmdbTvDetail({ number_of_episodes: 62 })).toEqual({ size: 62 });
  });
});
