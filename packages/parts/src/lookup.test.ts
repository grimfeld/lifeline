import { describe, expect, it } from "vitest";
import { lookupRows } from "./lookup";

const hit = (externalKey: string, title: string, creator = "", year = 0) => ({ externalKey, title, creator, year });
const byline = (h: { creator: string }) => h.creator;

describe("lookupRows", () => {
  it("lists a hit by its title, with creator and year under it", () => {
    const [row] = lookupRows([hit("tmdb:1", "Alien", "Ridley Scott", 1979)], byline);
    expect(row).toMatchObject({ value: "tmdb:1", label: "Alien", description: "Ridley Scott · 1979" });
    expect(row.hit.title).toBe("Alien");
  });

  it("leaves out a missing creator or year", () => {
    const rows = lookupRows([hit("a", "Untitled"), hit("b", "Solo", "", 2001), hit("c", "Anon", "Someone")], byline);
    expect(rows.map((r) => r.description)).toEqual(["", "2001", "Someone"]);
  });

  it("lists five hits at most", () => {
    const hits = Array.from({ length: 8 }, (_, i) => hit(`k${i}`, `T${i}`));
    expect(lookupRows(hits, byline).map((r) => r.value)).toEqual(["k0", "k1", "k2", "k3", "k4"]);
  });
});
