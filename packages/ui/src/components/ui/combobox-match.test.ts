import { describe, expect, it } from "vitest";
import { matchOptions, offersCreate } from "./combobox-match";

const authors = [
  { value: "1", label: "Ursula K. Le Guin", keywords: ["Le Guin, Ursula"] },
  { value: "2", label: "Stanisław Lem" },
  { value: "3", label: "Gabriel García Márquez", keywords: ["Gabo"] },
  { value: "4", label: "Frank Herbert" },
];

describe("matchOptions", () => {
  it("finds a name typed without its accents, in any case", () => {
    expect(matchOptions(authors, "garcia MARQUEZ").map((o) => o.value)).toEqual(["3"]);
    expect(matchOptions(authors, "stanislaw").map((o) => o.value)).toEqual(["2"]);
  });

  it("finds a name typed with accents the stored one lacks", () => {
    expect(matchOptions(authors, "Hérbert").map((o) => o.value)).toEqual(["4"]);
  });

  it("matches inside the name and on its keywords", () => {
    expect(matchOptions(authors, "guin").map((o) => o.value)).toEqual(["1"]);
    expect(matchOptions(authors, "gabo").map((o) => o.value)).toEqual(["3"]);
  });

  it("collapses runs of spaces in the query", () => {
    expect(matchOptions(authors, "  frank   herbert ").map((o) => o.value)).toEqual(["4"]);
  });

  it("puts names that start with the query before names that merely contain it", () => {
    const opts = [
      { value: "a", label: "The Lem Archive" },
      { value: "b", label: "Lem, collected" },
    ];
    expect(matchOptions(opts, "lem").map((o) => o.value)).toEqual(["b", "a"]);
  });

  it("offers every option for an empty query", () => {
    expect(matchOptions(authors, "   ")).toHaveLength(4);
  });
});

describe("offersCreate", () => {
  it("offers Create when nothing answers exactly to the typed name", () => {
    expect(offersCreate(authors, "Frank")).toBe(true);
  });

  it("does not offer Create when an option is the typed name, accents and case aside", () => {
    expect(offersCreate(authors, "stanislaw lem")).toBe(false);
    expect(offersCreate(authors, "  FRANK  herbert")).toBe(false);
  });

  it("does not offer Create when a keyword is the typed name", () => {
    expect(offersCreate(authors, "gabo")).toBe(false);
  });

  it("does not offer Create for an empty query", () => {
    expect(offersCreate(authors, "  ")).toBe(false);
  });
});
