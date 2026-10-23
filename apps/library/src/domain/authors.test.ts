import { describe, expect, it } from "vitest";
import type { Author, Work } from "./types";
import { answersTo, applyIdentity, confidentAuthorMatch, foldBibliography, mergeAliases, mergePlan, normalizeAuthorName, ownedByKey, relinkAuthors, splitAuthorNames, type AuthorHit } from "./authors";

const author = (p: Partial<Author>): Author => ({ id: "a", type: "author", title: "Frank Herbert", tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0, aliases: [], externalKey: "", photoUrl: "", born: "", died: "", ...p });

describe("names", () => {
  it("normalises case, diacritics and punctuation", () => {
    expect(normalizeAuthorName("  Ursula K. Le Guin ")).toBe("ursula k le guin");
    expect(normalizeAuthorName("Émile Zola")).toBe("emile zola");
  });
  it("splits a typed creator string on / & ; , and 'and', deduping", () => {
    expect(splitAuthorNames("Alan Moore / Dave Gibbons")).toEqual(["Alan Moore", "Dave Gibbons"]);
    expect(splitAuthorNames("A & B, C and D; a")).toEqual(["A", "B", "C", "D"]);
    expect(splitAuthorNames("Le Guin, Ursula K.")).toEqual(["Le Guin", "Ursula K."]);
    expect(splitAuthorNames("Anderson")).toEqual(["Anderson"]);
    expect(splitAuthorNames("  ")).toEqual([]);
  });
  it("an Author answers to its title or any alias", () => {
    const a = author({ aliases: ["Herbert, Frank"] });
    expect(answersTo(a, "frank herbert")).toBe(true);
    expect(answersTo(a, "Herbert, Frank")).toBe(true);
    expect(answersTo(a, "Brian Herbert")).toBe(false);
    expect(answersTo(a, "")).toBe(false);
  });
});

describe("confidentAuthorMatch", () => {
  const hit = (name: string, key = name): AuthorHit => ({ externalKey: `openlibrary:/authors/${key}`, name, alternateNames: [], born: "", died: "", topWork: "", workCount: 1 });
  it("needs exactly one exact-name hit", () => {
    expect(confidentAuthorMatch("Frank Herbert", [hit("Frank Herbert"), hit("Frank Herbert Jr.")])?.externalKey).toBe("openlibrary:/authors/Frank Herbert");
    expect(confidentAuthorMatch("John Williams", [hit("John Williams", "1"), hit("John Williams", "2")])).toBeNull();
    expect(confidentAuthorMatch("John Williams", [hit("John T. Williams")])).toBeNull();
    expect(confidentAuthorMatch("", [hit("")])).toBeNull();
  });
  it("counts an alternate name as exact", () => {
    expect(confidentAuthorMatch("Herbert, Frank", [{ ...hit("Frank Herbert"), alternateNames: ["Herbert, Frank"] }])).not.toBeNull();
  });
});

describe("identity and merge", () => {
  it("mergeAliases drops the title and duplicates", () => {
    expect(mergeAliases("Frank Herbert", ["frank herbert", "F. Herbert"], ["Herbert, Frank", "F. Herbert", ""])).toEqual(["F. Herbert", "Herbert, Frank"]);
  });
  it("applyIdentity fills key, years, photo and aliases, never the name", () => {
    const p = applyIdentity(author({ aliases: ["F. Herbert"] }), { externalKey: "openlibrary:/authors/OL1A", alternateNames: ["Herbert, Frank"], born: "1920", died: "1986", photoUrl: "https://x/p.jpg" });
    expect(p).toEqual({ externalKey: "openlibrary:/authors/OL1A", born: "1920", died: "1986", photoUrl: "https://x/p.jpg", aliases: ["F. Herbert", "Herbert, Frank"] });
    expect(p).not.toHaveProperty("title");
    expect(applyIdentity(author({ externalKey: "openlibrary:/authors/OL1A" }), { externalKey: "openlibrary:/authors/OL1A", alternateNames: [], born: "", died: "" })).toEqual({});
  });
  it("mergePlan: loser's names become aliases, body appended, identity only where missing", () => {
    const survivor = author({ id: "s", title: "J.R.R. Tolkien", externalKey: "openlibrary:/authors/OL26320A", body: "Mine.\n", born: "1892" });
    const loser = author({ id: "l", title: "Tolkien, J. R. R.", aliases: ["Tolkien"], body: "Theirs.", externalKey: "openlibrary:/authors/OLxA", died: "1973", photoUrl: "https://x/t.jpg" });
    expect(mergePlan(survivor, loser)).toEqual({ aliases: ["Tolkien, J. R. R.", "Tolkien"], body: "Mine.\n\n---\n\nTheirs.\n", photoUrl: "https://x/t.jpg", died: "1973" });
    expect(mergePlan(author({ body: "" }), author({ title: "Frank Herbert", body: "Only theirs" }))).toEqual({ body: "Only theirs\n" });
  });
  it("relinkAuthors swaps the loser for the survivor once, keeping order", () => {
    expect(relinkAuthors(["l", "x"], "l", "s")).toEqual(["s", "x"]);
    expect(relinkAuthors(["s", "l"], "l", "s")).toEqual(["s"]);
    expect(relinkAuthors(["x"], "l", "s")).toEqual(["x"]);
  });
});

describe("Bibliography", () => {
  const row = (title: string, year = 0, coverUrl = "", key = title) => ({ externalKey: `openlibrary:/works/${key}`, title, year, coverUrl });
  it("folds same titles keeping the row with a cover, sinks year-less rows, newest first", () => {
    const rows = [row("Dune", 0, "", "a"), row("Dune", 1965, "https://c/1.jpg", "b"), row("Dune Messiah", 1969), row("Untitled", 0), row("dune", 1966, "", "c")];
    expect(foldBibliography(rows).map((r) => r.externalKey)).toEqual(["openlibrary:/works/Dune Messiah", "openlibrary:/works/b", "openlibrary:/works/Untitled"]);
    expect(foldBibliography(rows, true)).toHaveLength(5);
    expect(foldBibliography(rows, true)[0]?.title).toBe("Dune Messiah");
  });
  it("ownedByKey finds the Work for a row by external key, in one pass over the shelf (CR-58)", () => {
    const w = { externalKey: "openlibrary:/works/b" } as Work;
    const later = { externalKey: "openlibrary:/works/b" } as Work;
    const keyless = { externalKey: "" } as Work;
    const owned = ownedByKey([w, later, keyless]);
    expect(owned.get(row("Dune", 1965, "", "b").externalKey)).toBe(w);
    expect(owned.get(row("Dune", 1965, "", "z").externalKey)).toBeUndefined();
    expect(owned.has("")).toBe(false);
  });
});
