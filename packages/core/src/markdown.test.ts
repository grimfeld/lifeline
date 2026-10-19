import { describe, expect, it } from "vitest";
import {
  excerpt,
  extractBlocks,
  extractHeadings,
  extractLinks,
  extractTags,
  normalizeName,
  parseBlockOptions,
  readCoords,
  renameLinks,
  serializeFrontmatter,
  splitFrontmatter,
  withProperties,
  writeCoords,
} from "./markdown";

describe("frontmatter", () => {
  it("parses scalars, inline lists and block lists", () => {
    const { properties, content } = splitFrontmatter("---\naliases:\n  - Adel\n  - \"A. B\"\nmood: 4\nkind: home\ntags: [a, b]\n---\nBody");
    expect(properties).toEqual({ aliases: ["Adel", "A. B"], mood: 4, kind: "home", tags: ["a", "b"] });
    expect(content).toBe("Body");
  });
  it("round-trips through serialize / withProperties and drops empties", () => {
    const fm = serializeFrontmatter({ mood: "3", aliases: ["X", ""], address: "", location: ["48.9", "2.3"] });
    expect(fm).toBe("---\nmood: 3\naliases:\n  - X\nlocation: [48.9, 2.3]\n---\n");
    expect(splitFrontmatter(fm + "hi").properties).toEqual({ mood: 3, aliases: ["X"], location: ["48.9", "2.3"] });
    expect(withProperties("---\nmood: 1\n---\nBody", { mood: "5" })).toBe("---\nmood: 5\n---\nBody");
    expect(withProperties("Body", {})).toBe("Body");
  });
  it("reads and writes coordinates as [lat, lon]", () => {
    expect(readCoords(["48.9", "2.3"])).toEqual({ lat: 48.9, lon: 2.3 });
    expect(readCoords("48.9,2.3")).toEqual({ lat: 48.9, lon: 2.3 });
    expect(readCoords(["91", "0"])).toBeNull();
    expect(readCoords(undefined)).toBeNull();
    expect(readCoords("Paris")).toBeNull();
    expect(writeCoords({ lat: 48.9, lon: 2.3 })).toEqual(["48.9", "2.3"]);
    expect(writeCoords(null)).toBe("");
  });
  it("no frontmatter → empty properties, content untouched", () => {
    expect(splitFrontmatter("--- not fm\nx")).toEqual({ properties: {}, content: "--- not fm\nx", raw: "" });
  });
});

describe("links", () => {
  it("extracts name / heading / alias / embed with offsets, skipping code", () => {
    const text = "See [[Yasmine|Y]] and [[Paris#Trip]] ![[img.png]] `[[not]]`\n```\n[[nope]]\n```";
    const links = extractLinks(text);
    expect(links.map((l) => [l.name, l.alias, l.heading, l.embed])).toEqual([
      ["Yasmine", "Y", undefined, false],
      ["Paris", undefined, "Trip", false],
      ["img.png", undefined, undefined, true],
    ]);
    expect(text.slice(links[0].from, links[0].to)).toBe("[[Yasmine|Y]]");
  });
  it("renames links case-insensitively, keeping alias and heading", () => {
    expect(renameLinks("a [[old name|x]] b [[Old Name#h]] c [[other]]", "old name", "New")).toBe("a [[New|x]] b [[New#h]] c [[other]]");
  });
});

describe("tags / headings / blocks", () => {
  it("finds tags but not headings, numbers or code", () => {
    expect(extractTags("# Title\n#quote and #Life/Work #2024 (#x) `#no`\n```\n#nope\n```")).toEqual(["quote", "life/work", "x"]);
  });
  it("unions the frontmatter tags list with prose #tags, frontmatter first", () => {
    expect(extractTags("---\ntags:\n  - Garden\n  - work/home\n---\nhello #prose")).toEqual(["garden", "work/home", "prose"]);
    expect(extractTags("---\ntags: [a, b]\n---\n#c")).toEqual(["a", "b", "c"]);
  });
  it("accepts a scalar tags value (comma / space separated)", () => {
    expect(extractTags("---\ntags: alpha, beta gamma\n---\n")).toEqual(["alpha", "beta", "gamma"]);
    expect(extractTags("---\ntags: solo\n---\n")).toEqual(["solo"]);
  });
  it("dedupes across frontmatter and prose and normalises #-prefixed / cased values", () => {
    expect(extractTags("---\ntags:\n  - \"#Quote\"\n  - life work\n---\n#quote #Life-Work #2024")).toEqual(["quote", "life-work"]);
    expect(extractTags("---\ntags: []\n---\nnothing")).toEqual([]);
    expect(extractTags("---\ntitle: x\n---\n#a")).toEqual(["a"]);
  });
  it("extracts headings outside fences", () => {
    expect(extractHeadings("# A\ntext\n### B ###\n```\n# no\n```")).toEqual([
      { level: 1, text: "A", line: 0 },
      { level: 3, text: "B", line: 2 },
    ]);
  });
  it("finds fenced blocks incl. empty ones with lang and offsets", () => {
    const text = "x\n```daylog\napps: tasks\n```\ny\n```daylog\n```\n";
    const blocks = extractBlocks(text);
    expect(blocks.map((b) => [b.lang, b.body])).toEqual([["daylog", "apps: tasks"], ["daylog", ""]]);
    expect(text.slice(blocks[0].from, blocks[0].to)).toBe("```daylog\napps: tasks\n```");
    expect(text.slice(blocks[1].from, blocks[1].to)).toBe("```daylog\n```");
    expect(parseBlockOptions(blocks[0].body)).toEqual({ apps: "tasks" });
  });
  it("reads a CRLF heading without its carriage return", () => {
    expect(extractHeadings("## Title ##\r\ntext")).toEqual([{ level: 2, text: "Title", line: 0 }]);
  });
  it("reads long, hostile lines in linear time", () => {
    const spaces = " ".repeat(50_000);
    const started = performance.now();
    expect(extractHeadings(`# a${spaces}\rx`)).toHaveLength(1);
    expect(extractHeadings(`#${spaces}`)).toEqual([{ level: 1, text: " ", line: 0 }]);
    expect(extractHeadings(`# a${"#".repeat(50_000)}x`)).toHaveLength(1);
    expect(extractHeadings(`# a${" #".repeat(50_000)}x`)).toHaveLength(1);
    expect(parseBlockOptions(`apps:${spaces}x\r`)).toEqual({ apps: "x" });
    expect(splitFrontmatter(`---\nkind:${spaces}x\r\n---\n`).properties).toEqual({ kind: "x" });
    expect(performance.now() - started).toBeLessThan(1000);
  });
  it("excerpt strips syntax", () => {
    expect(excerpt("---\nmood: 3\n---\n### Head\nHello [[World|there]] **bold**")).toBe("Head Hello there bold");
  });
});

describe("normalizeName", () => {
  it("folds case, whitespace and accents", () => {
    expect(normalizeName("  Léa   Dupont ")).toBe("lea dupont");
    expect(normalizeName("Lea")).toBe(normalizeName("Léa"));
    expect(normalizeName("Ça")).toBe("ca");
    // an already-decomposed é (e + combining acute) folds the same
    expect(normalizeName("Léa")).toBe("lea");
  });
});
