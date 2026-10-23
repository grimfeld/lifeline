import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document } from "./types";

const put = vi.fn(async (d: Document) => d);
vi.mock("./store", () => ({ putDocument: (d: Document) => put(d) }));

import { conflictCopy } from "./conflict";

const doc = (over: Partial<Document>): Document =>
  ({ id: "a", type: "note", title: "T", body: "mine", tags: [], folder: "F", createdAt: "2026-01-01", updatedAt: "2026-01-01T00:00:00.000Z", deleted: 0, ...over }) as Document;

describe("conflictCopy (ADR 0010)", () => {
  beforeEach(() => {
    put.mockClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 9, 5));
  });

  it("saves the local edit as a sibling titled with the time, linked back by conflictOf", async () => {
    await conflictCopy(doc({}), doc({ body: "theirs" }));
    const copy = put.mock.calls[0]![0];
    expect(copy).toMatchObject({ type: "note", folder: "F", title: "T (conflict 09:05)", body: "mine", conflictOf: "T" });
    expect(copy.id).not.toBe("a");
    expect(copy.updatedAt).toBeUndefined();
    expect(copy.deleted).toBeUndefined();
  });

  it("keeps every field of the local Document (a Note keeps its Source)", async () => {
    await conflictCopy(doc({ source: "s1", locator: "p. 4", aliases: ["x"], tags: ["a"], workspace: "w" }), doc({ body: "theirs" }));
    expect(put.mock.calls[0]![0]).toMatchObject({ source: "s1", locator: "p. 4", aliases: ["x"], tags: ["a"], workspace: "w" });
  });

  it("does nothing when the body and title are the same", async () => {
    await conflictCopy(doc({}), doc({ source: "other" }));
    expect(put).not.toHaveBeenCalled();
  });

  it("copes with a missing body and folder", async () => {
    await conflictCopy(doc({ body: undefined, folder: undefined as never }), doc({ title: "Z" }));
    expect(put.mock.calls[0]![0]).toMatchObject({ body: "", folder: "" });
  });
});
