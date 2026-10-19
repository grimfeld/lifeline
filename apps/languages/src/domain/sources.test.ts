import { describe, expect, it } from "vitest";
import type { Document } from "@lifeline/core";
import { sourceChain, type SourceReading } from "./sources";

const doc = (id: string, type: string, link = ""): Document & { link: string } => ({ id, type, title: id, tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, link }) as Document & { link: string };

function reading(docs: (Document & { link: string })[]): SourceReading {
  const byId = new Map(docs.map((d) => [d.id, d]));
  return { get: (id) => byId.get(id), isSource: (d) => d.type === "source" || d.type === "book", linkedSource: (d) => (d as Document & { link: string }).link };
}

describe("sourceChain", () => {
  const read = reading([
    doc("show", "source"),
    doc("ep", "source", "show"),
    doc("note", "note", "ep"),
    doc("quote", "quote", "ep"),
    doc("book", "book"), // a work wearing the Source Role
    doc("thought", "thought"),
    doc("a", "source", "b"),
    doc("b", "source", "a"),
  ]);

  it("follows a Note to its Source, then up to every Source it is part of", () => {
    expect(sourceChain("note", read)).toEqual(["ep", "show"]);
    expect(sourceChain("quote", read)).toEqual(["ep", "show"]);
  });

  it("starts at the origin when it is itself a Source", () => {
    expect(sourceChain("ep", read)).toEqual(["ep", "show"]);
    expect(sourceChain("book", read)).toEqual(["book"]);
  });

  it("counts toward nothing when there is no Source on the way", () => {
    expect(sourceChain("thought", read)).toEqual([]);
    expect(sourceChain("", read)).toEqual([]);
    expect(sourceChain("gone", read)).toEqual([]);
  });

  it("stops at a loop in the parents", () => {
    expect(sourceChain("a", read)).toEqual(["a", "b"]);
  });
});
