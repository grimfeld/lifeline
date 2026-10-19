import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "./types";

/**
 * Link rewrites reach locked Private notes (ADR 0038's one exception): the
 * gated read hides them, the rewrite read does not.
 */

const doc = (id: string, folder: string, body?: string): Document =>
  ({ id, type: "note", title: id, folder, tags: [], body, updatedAt: "", deleted: 0 }) as unknown as Document;

const state = vi.hoisted(() => ({ gated: [] as Document[], ungated: [] as Document[], written: [] as Document[] }));

vi.mock("./store", () => ({
  allDocuments: async () => state.gated,
  putDocument: async (d: Document) => {
    state.written.push(d);
    return d;
  },
}));
vi.mock("./rewrite", () => ({ documentsForLinkRewrite: async () => state.ungated }));
// Private is set up and locked.
vi.mock("../private", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../private")>()),
  privateGate: async () => ({ configured: true, locked: true }),
  assertNotReservedFolder: async () => {},
}));
// The empty-folder list lives in _meta.
vi.mock("../data/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../data/db")>()),
  db: () => ({ _meta: { get: async () => undefined, put: async () => {} } }),
}));

const { renameDocument, renameFolder } = await import("./ops");

beforeEach(() => {
  state.written = [];
});

describe("link rewrites while Private is locked (CR-06)", () => {
  it("rewrites [[Old]] in a locked Private note on rename", async () => {
    const old = doc("Old", "");
    const secret = doc("Secret", "Private", "see [[Old]]");
    state.gated = [old];
    state.ungated = [old, secret];
    await renameDocument(old, "New");
    expect(state.written.map((d) => [d.id, d.title, d.body])).toEqual([
      ["Old", "New", undefined],
      ["Secret", "Secret", "see [[New]]"],
    ]);
  });

  it("rewrites path links in a locked Private note on a folder rename", async () => {
    const a = doc("A", "f");
    const secret = doc("Secret", "Private", "see [[f/A]]");
    state.gated = [a];
    state.ungated = [a, secret];
    await renameFolder("f", "g");
    expect(state.written.map((d) => [d.id, d.folder, d.body])).toEqual([
      ["A", "g", undefined],
      ["Secret", "Private", "see [[g/A]]"],
    ]);
  });
});
