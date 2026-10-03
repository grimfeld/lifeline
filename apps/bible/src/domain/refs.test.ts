import { describe, expect, it } from "vitest";
import { canonical, chapterTitles, expanders, kindOf, linkRefs, parseRef, scanRefs, verseTitles } from "./refs";

describe("parseRef", () => {
  it("reads books, chapters, verses and ranges in their many spellings", () => {
    expect(canonical(parseRef("John")!)).toBe("John");
    expect(canonical(parseRef("Jn 3")!)).toBe("John 3");
    expect(canonical(parseRef("John 3:16")!)).toBe("John 3:16");
    expect(canonical(parseRef("john 3.16")!)).toBe("John 3:16");
    expect(canonical(parseRef("John 3:16-18")!)).toBe("John 3:16–18");
    expect(canonical(parseRef("Rom. 8:28 – 30")!)).toBe("Romans 8:28–30");
    expect(canonical(parseRef("1 Cor 13:4-7")!)).toBe("1 Corinthians 13:4–7");
    expect(canonical(parseRef("Song of Solomon 2:1")!)).toBe("Song of Songs 2:1");
    expect(canonical(parseRef("John 3:16-4:2")!)).toBe("John 3:16–4:2");
  });
  it("treats a single-chapter book's number as a verse", () => {
    expect(canonical(parseRef("Jude 3")!)).toBe("Jude 1:3");
    expect(canonical(parseRef("Philemon 1")!)).toBe("Philemon 1");
  });
  it("rejects what is not a reference", () => {
    expect(parseRef("Paul")).toBeNull();
    expect(parseRef("John 99")).toBeNull();
    expect(parseRef("Dune")).toBeNull();
    expect(parseRef("John 3:18-16")!.toVerse).toBeNull();
  });
  it("bounds a verse by the longest chapter (Psalm 119, 176 verses)", () => {
    expect(canonical(parseRef("Psalm 119:176")!)).toBe("Psalms 119:176");
    expect(parseRef("Psalm 119:177")).toBeNull();
    expect(parseRef("John 3:1-100000")).toBeNull();
    expect(parseRef("John 3:16-4:100000")).toBeNull();
    expect(expanders.verse("John 3:1-100000")).toBeNull();
  });
  it("knows its kind", () => {
    expect(kindOf(parseRef("Acts")!)).toBe("book");
    expect(kindOf(parseRef("Acts 2")!)).toBe("chapter");
    expect(kindOf(parseRef("Acts 2:42")!)).toBe("verse");
  });
});

describe("expansion", () => {
  it("a range stands for every verse in it", () => {
    expect(verseTitles(parseRef("John 3:16-18")!)).toEqual(["John 3:16", "John 3:17", "John 3:18"]);
    expect(verseTitles(parseRef("John 3:16")!)).toEqual(["John 3:16"]);
  });
  it("a cross-chapter range stands for its chapters, not verses", () => {
    expect(verseTitles(parseRef("John 3:16-4:2")!)).toEqual([]);
    expect(chapterTitles(parseRef("John 3:16-4:2")!)).toEqual(["John 3", "John 4"]);
  });
  it("each expander answers only for its own kind", () => {
    expect(expanders.verse("Jn 3:16-17")).toEqual(["John 3:16", "John 3:17"]);
    expect(expanders.verse("John 3")).toBeNull();
    expect(expanders.chapter("John 3")).toEqual(["John 3"]);
    expect(expanders.chapter("John 3:16")).toBeNull();
    expect(expanders.book("Romans")).toEqual(["Romans"]);
    expect(expanders.book("Dune")).toBeNull();
    expect(expanders.verse("Paul")).toBeNull();
  });
});

describe("scanRefs / linkRefs", () => {
  it("finds bare references outside code and existing links", () => {
    const body = "See Rom 8:28 and (Jn 3:16–18); already [[John 1:1]] here. `Ps 23` in code. John went home. Psalm 23 too.";
    const found = scanRefs(body);
    expect(found.map((f) => canonical(f.ref))).toEqual(["Romans 8:28", "John 3:16–18", "Psalms 23"]);
    expect(found[0].text).toBe("Rom 8:28");
  });
  it("wraps them as wikilinks keeping what was written as the alias", () => {
    const body = "See Rom 8:28 and Psalm 23.";
    expect(linkRefs(body, scanRefs(body))).toBe("See [[Romans 8:28|Rom 8:28]] and [[Psalms 23|Psalm 23]].");
  });
  it("does not read ordinary words as short book forms", () => {
    const found = (body: string) => scanRefs(body).map((f) => canonical(f.ref));
    expect(found("The meeting is 10:30 tomorrow.")).toEqual([]);
    expect(found("Il reste de 3 à 5 jours.")).toEqual([]);
    expect(found("I am 5 minutes late, so 2 of us left; my job 3 days a week.")).toEqual([]);
    expect(found("the mt 5 bus")).toEqual([]);
  });
  it("still reads short forms written capitalised, dotted, or with a verse", () => {
    const found = (body: string) => scanRefs(body).map((f) => canonical(f.ref));
    expect(found("See Is 53:5, is. 40:31 and Isa 6.")).toEqual(["Isaiah 53:5", "Isaiah 40:31", "Isaiah 6"]);
    expect(found("De 6:4 and Am 5:24; Job 38; Mt 5 and mt 5:3.")).toEqual(["Deuteronomy 6:4", "Amos 5:24", "Job 38", "Matthew 5", "Matthew 5:3"]);
  });
  it("does not scan bare book names", () => {
    expect(scanRefs("Paul wrote to the Romans and John was there.")).toEqual([]);
  });
});
