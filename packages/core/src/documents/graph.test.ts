import { describe, expect, it } from "vitest";
import { buildLinkIndex } from "./links";
import { buildGraph, localGraph } from "./graph";
import type { Document, DocumentTypeDef } from "./types";

const types: DocumentTypeDef[] = [
  { id: "note", label: "Notes", fields: [], linkable: true } as unknown as DocumentTypeDef,
  {
    id: "person",
    label: "People",
    fields: [{ key: "employer", kind: "link", label: "Employer" }],
    linkable: true,
  } as unknown as DocumentTypeDef,
  { id: "entry", label: "Entries", fields: [], linkable: false } as unknown as DocumentTypeDef,
  { id: "version", label: "Versions", fields: [], linkable: true, internal: true } as unknown as DocumentTypeDef,
];

const doc = (partial: Partial<Document> & { id: string; type: string; title: string }): Document =>
  ({ tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, ...partial }) as unknown as Document;

const fixture = () => [
  doc({ id: "a", type: "note", title: "Alpha", body: "See [[Beta]] and [[Beta]] again, plus [[Missing]]." }),
  doc({ id: "b", type: "note", title: "Beta", body: "Back to [[Alpha]].", tags: ["work"] }),
  doc({ id: "c", type: "note", title: "Gamma", body: "", tags: ["work"] }),
  doc({ id: "p", type: "person", title: "Paula", employer: "c" } as never),
  doc({ id: "e", type: "entry", title: "42", body: "[[Alpha]]" }),
  doc({ id: "v", type: "version", title: "v1", body: "[[Alpha]]" }),
];

const graph = (opts = {}) => buildGraph(buildLinkIndex(fixture(), types), types, opts);

describe("buildGraph", () => {
  it("merges both directions and repeat mentions into one weighted edge", () => {
    const g = graph();
    const ab = g.edges.filter((e) => [e.source, e.target].sort().join() === "d:a,d:b");
    expect(ab).toHaveLength(1);
    expect(ab[0].weight).toBe(3); // Alpha→Beta ×2 and Beta→Alpha
  });

  it("includes Link-field edges", () => {
    const g = graph();
    expect(g.edges.some((e) => [e.source, e.target].sort().join() === "d:c,d:p")).toBe(true);
  });

  it("keeps non-linkable and internal types out entirely", () => {
    const g = graph({ orphans: true });
    expect(g.nodes.some((n) => n.id === "d:e" || n.id === "d:v")).toBe(false);
    // Their mentions of Alpha create no edges either.
    expect(g.edges.every((e) => e.source !== "d:e" && e.source !== "d:v")).toBe(true);
  });

  it("hides orphans by default, shows them on request", () => {
    expect(graph().nodes.some((n) => n.id === "d:c")).toBe(true); // linked via field
    const noField = buildGraph(buildLinkIndex([fixture()[0], fixture()[1], fixture()[2]], types), types, {});
    expect(noField.nodes.some((n) => n.id === "d:c")).toBe(false);
    const withOrphans = buildGraph(buildLinkIndex([fixture()[0], fixture()[1], fixture()[2]], types), types, { orphans: true });
    expect(withOrphans.nodes.some((n) => n.id === "d:c")).toBe(true);
  });

  it("adds ghost nodes for unresolved names, toggleable", () => {
    const g = graph();
    const ghost = g.nodes.find((n) => n.kind === "ghost");
    expect(ghost?.label).toBe("missing");
    expect(g.edges.some((e) => e.source === "d:a" && e.target === ghost!.id)).toBe(true);
    expect(graph({ ghosts: false }).nodes.some((n) => n.kind === "ghost")).toBe(false);
  });

  it("adds tag nodes on request, connected to linkable Documents only", () => {
    const g = graph({ tags: true });
    const tag = g.nodes.find((n) => n.kind === "tag");
    expect(tag?.label).toBe("#work");
    const touching = g.edges.filter((e) => e.source === tag!.id || e.target === tag!.id);
    expect(touching).toHaveLength(2); // Beta and Gamma, never the Entry
  });

  it("filters by hidden types and tag filter", () => {
    expect(graph({ hiddenTypes: new Set(["person"]) }).nodes.some((n) => n.type === "person")).toBe(false);
    const g = graph({ tagFilter: ["work"] });
    expect(g.nodes.filter((n) => n.kind === "doc").map((n) => n.id).sort()).toEqual(["d:b", "d:c"]);
  });

  it("computes degrees from merged edges", () => {
    const g = graph();
    expect(g.nodes.find((n) => n.id === "d:a")?.degree).toBe(2); // Beta + ghost
  });
});

describe("localGraph", () => {
  it("limits to the centre's neighbourhood at the given depth", () => {
    const full = graph({ orphans: true });
    const d1 = localGraph(full, "b", 1);
    expect(d1.nodes.map((n) => n.id).sort()).toEqual(["d:a", "d:b"]);
    const d2 = localGraph(full, "b", 2);
    expect(d2.nodes.some((n) => n.kind === "ghost")).toBe(true); // Alpha's ghost, two steps out
  });

  it("keeps an unlinked centre when the source model holds orphans", () => {
    const full = graph({ orphans: true });
    const local = localGraph(full, "p", 1);
    expect(local.nodes.some((n) => n.id === "d:p")).toBe(true);
  });
});
