import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sync engine against an in-memory stand-in for Dexie and PocketBase:
 * just enough of each for one push + pull cycle.
 */

type Row = Record<string, unknown> & { id: string };
type ServerRow = Row & { updated: string };

const fake = vi.hoisted(() => {
  const state = {
    meta: new Map<string, string>(),
    outbox: [] as { seq: number; collection: string; recordId: string }[],
    tables: new Map<string, Map<string, Row>>(),
    server: new Map<string, ServerRow[]>(),
    collections: ["things"],
    bound: undefined as { id: string; email: string } | undefined,
    boundCalls: 0,
    boundGate: null as Promise<void> | null,
    /** Called after each getList, so a test can change the server mid-pull. */
    afterList: null as null | ((name: string, call: number) => void),
    listCalls: 0,
    /** Records whose update the server answers with a 500. */
    failUpdate: new Set<string>(),
    /** Every write request the engine sends, as `method collection/id`. */
    requests: [] as string[],
    afterGetOne: null as null | (() => void),
    onConflict: null as null | ((local: Row, server: Row) => Promise<void>),
    /** Local reads, by kind: a pull reads a page at once, never row by row. */
    localGets: 0,
    localBulkGets: 0,
  };
  const table = (name: string) => {
    let t = state.tables.get(name);
    if (!t) state.tables.set(name, (t = new Map()));
    return t;
  };
  return { state, table };
});

vi.mock("./db", () => ({
  ATTACHMENTS: "attachments",
  BLOBS: "_blobs",
  DOCUMENTS: "documents",
  syncedCollectionNames: () => fake.state.collections,
  db: () => ({
    _outbox: {
      orderBy: () => ({ toArray: async () => [...fake.state.outbox] }),
      count: async () => fake.state.outbox.length,
      where: () => ({ equals: (c: string) => ({ toArray: async () => fake.state.outbox.filter((e) => e.collection === c) }) }),
      bulkDelete: async (seqs: number[]) => {
        fake.state.outbox = fake.state.outbox.filter((e) => !seqs.includes(e.seq));
      },
    },
    _meta: {
      get: async (key: string) => (fake.state.meta.has(key) ? { key, value: fake.state.meta.get(key) } : undefined),
      put: async (e: { key: string; value: string }) => void fake.state.meta.set(e.key, e.value),
    },
    collection: (name: string) => ({
      get: async (id: string) => {
        fake.state.localGets++;
        return fake.table(name).get(id);
      },
      bulkGet: async (ids: string[]) => {
        fake.state.localBulkGets++;
        return ids.map((id) => fake.table(name).get(id));
      },
      put: async (r: Row) => void fake.table(name).set(r.id, r),
      bulkPut: async (rs: Row[]) => void rs.forEach((r) => fake.table(name).set(r.id, r)),
      update: async (id: string, patch: Row) => void fake.table(name).set(id, { ...fake.table(name).get(id)!, ...patch }),
    }),
    table: (name: string) => ({ get: async (id: string) => fake.table(name).get(id) }),
    transaction: async (...args: unknown[]) => (args[args.length - 1] as () => Promise<void>)(),
  }),
}));

vi.mock("./account", () => ({
  currentAccount: () => ({ id: "me", email: "" }),
  boundAccount: async () => {
    fake.state.boundCalls++;
    if (fake.state.boundGate) await fake.state.boundGate;
    return fake.state.bound;
  },
  bindAccount: async (a: { id: string; email: string }) => void (fake.state.bound = a),
}));

vi.mock("../documents/registry", () => ({
  documentTypeSync: () => (fake.state.onConflict ? { onConflict: fake.state.onConflict } : undefined),
}));

/** The filter expressions the engine sends, read back by the fake server. */
vi.mock("./pb", () => ({
  pb: {
    authStore: { isValid: true },
    filter: (expr: string, params: Record<string, unknown>) => JSON.stringify({ expr, params }),
    collection: (name: string) => ({
      getList: async (page: number, perPage: number, opts: { filter?: string; sort?: string }) => {
        const call = ++fake.state.listCalls;
        let rows = [...(fake.state.server.get(name) ?? [])];
        if (opts.filter) {
          const { params } = JSON.parse(opts.filter) as { params: Record<string, string> };
          const ids = Object.keys(params).filter((k) => /^id\d+$/.test(k)).map((k) => params[k]);
          if (ids.length) {
            rows = rows.filter((r) => ids.includes(r.id));
          } else {
            const u = (params.u ?? params.c)!;
            const id = params.id;
            rows = rows.filter((r) => r.updated > u || (id !== undefined && r.updated === u && r.id > id));
          }
        }
        rows.sort((a, b) => a.updated.localeCompare(b.updated) || a.id.localeCompare(b.id));
        const items = rows.slice((page - 1) * perPage, page * perPage);
        fake.state.afterList?.(name, call);
        return { items };
      },
      getOne: async (id: string) => {
        fake.state.requests.push(`getOne ${name}/${id}`);
        const r = (fake.state.server.get(name) ?? []).find((x) => x.id === id);
        if (!r) throw Object.assign(new Error("not found"), { status: 404 });
        fake.state.afterGetOne?.();
        return r;
      },
      // Last-writer-wins as pb_hooks/lww.pb.js keeps it: an older `updatedAt` is refused with 409.
      update: async (id: string, body: Row) => {
        fake.state.requests.push(`update ${name}/${id}`);
        if (fake.state.failUpdate.has(id)) throw Object.assign(new Error("server error"), { status: 500 });
        const rows = fake.state.server.get(name) ?? [];
        const i = rows.findIndex((x) => x.id === id);
        const row = rows[i];
        if (!row) throw Object.assign(new Error("not found"), { status: 404 });
        if (String(row.updatedAt) > String(body.updatedAt)) throw Object.assign(new Error("stale"), { status: 409 });
        const updated = { ...body, id, updated: stamp(9000) };
        rows[i] = updated;
        return updated;
      },
      create: async (body: Row) => {
        fake.state.requests.push(`create ${name}/${body.id}`);
        fake.state.server.set(name, [...(fake.state.server.get(name) ?? []), { ...body, updated: stamp(9000) }]);
        return body;
      },
    }),
  },
}));

const { nextPullDelay, pushNow, requestSync, startSync, syncNow } = await import("./sync");

const stamp = (i: number) => `2026-10-01 10:00:${String(Math.floor(i / 1000)).padStart(2, "0")}.${String(i % 1000).padStart(3, "0")}Z`;
const serverRow = (i: number, over: Partial<ServerRow> = {}): ServerRow => ({
  id: `r${String(i).padStart(4, "0")}`,
  updated: stamp(i),
  updatedAt: stamp(i),
  deleted: 0,
  ...over,
});

beforeEach(() => {
  fake.state.meta.clear();
  fake.state.outbox = [];
  fake.state.tables.clear();
  fake.state.server.clear();
  fake.state.collections = ["things"];
  fake.state.bound = { id: "me", email: "" };
  fake.state.boundCalls = 0;
  fake.state.boundGate = null;
  fake.state.afterList = null;
  fake.state.listCalls = 0;
  fake.state.failUpdate.clear();
  fake.state.requests = [];
  fake.state.onConflict = null;
  fake.state.afterGetOne = null;
  fake.state.localGets = 0;
  fake.state.localBulkGets = 0;
});

describe("syncNow", () => {
  it("never runs two cycles at once, even when triggered before the account check resolves (CR-01)", async () => {
    let release!: () => void;
    fake.state.boundGate = new Promise<void>((r) => (release = r));
    const a = syncNow();
    const b = syncNow();
    // The second trigger is queued behind the first rather than racing it…
    expect(fake.state.boundCalls).toBe(1);
    release();
    await Promise.all([a, b]);
    // …and runs once the first has finished.
    await vi.waitFor(() => expect(fake.state.boundCalls).toBe(2));
    await vi.waitFor(() => expect(fake.state.listCalls).toBe(2));
  });
});

describe("pushNow", () => {
  it("pushes the outbox without pulling any collection", async () => {
    fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(1), deleted: 0 });
    fake.state.outbox = [{ seq: 1, collection: "things", recordId: "r0001" }];
    fake.state.server.set("things", [serverRow(5)]);
    await pushNow();
    expect(fake.state.outbox).toEqual([]);
    expect(fake.state.listCalls).toBe(0);
    expect(fake.table("things").has("r0005")).toBe(false);
  });
});

describe("push (#273)", () => {
  const queue = (collection: string, ...ids: string[]) => {
    fake.state.outbox = ids.map((recordId, i) => ({ seq: i + 1, collection, recordId }));
  };

  it("sends one request for an uncontested edit", async () => {
    fake.state.server.set("things", [serverRow(1)]);
    fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(2), deleted: 0, n: 2 });
    queue("things", "r0001");
    await pushNow();
    expect(fake.state.requests).toEqual(["update things/r0001"]);
    expect(fake.state.outbox).toEqual([]);
    expect(fake.state.server.get("things")![0]).toMatchObject({ n: 2, updatedAt: stamp(2) });
  });

  it("coalesces several queued writes of one record into one request", async () => {
    fake.state.server.set("things", [serverRow(1)]);
    fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(3), deleted: 0 });
    queue("things", "r0001", "r0001", "r0001");
    await pushNow();
    expect(fake.state.requests).toEqual(["update things/r0001"]);
  });

  it("creates a record the server does not have (404 → create)", async () => {
    fake.table("things").set("r0007", { id: "r0007", updatedAt: stamp(7), deleted: 0 });
    queue("things", "r0007");
    await pushNow();
    expect(fake.state.requests).toEqual(["update things/r0007", "create things/r0007"]);
    expect(fake.state.server.get("things")).toEqual([expect.objectContaining({ id: "r0007" })]);
    expect(fake.state.outbox).toEqual([]);
  });

  it("keeps the newer server copy (LWW) and stores it locally", async () => {
    fake.state.server.set("things", [serverRow(5, { id: "r0001", n: "server" })]);
    fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(1), deleted: 0, n: "mine" });
    queue("things", "r0001");
    await pushNow();
    expect(fake.state.requests).toEqual(["update things/r0001", "getOne things/r0001"]);
    expect(fake.state.server.get("things")![0]).toMatchObject({ n: "server" });
    expect(fake.table("things").get("r0001")).toEqual({ id: "r0001", updatedAt: stamp(5), deleted: 0, n: "server" });
    expect(fake.state.outbox).toEqual([]);
  });

  it("hands the losing Document edit to its type's onConflict (ADR 0010)", async () => {
    fake.state.collections = ["documents"];
    const seen: [Row, Row][] = [];
    fake.state.onConflict = async (local, server) => void seen.push([local, server]);
    fake.state.server.set("documents", [serverRow(5, { id: "d1", type: "note", body: "theirs", fields: {} })]);
    fake.table("documents").set("d1", { id: "d1", type: "note", updatedAt: stamp(1), deleted: 0, body: "mine", tags: [], folder: "", workspace: "" });
    queue("documents", "d1");
    await pushNow();
    expect(seen).toHaveLength(1);
    const [mine, theirs] = seen[0] ?? [];
    expect(mine).toMatchObject({ body: "mine" });
    expect(theirs).toMatchObject({ body: "theirs" });
    expect(fake.table("documents").get("d1")).toMatchObject({ body: "theirs" });
  });

  it("leaves a write made during the conflict queued, and the local row alone", async () => {
    fake.state.server.set("things", [serverRow(5, { id: "r0001", n: "server" })]);
    fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(1), deleted: 0, n: "mine" });
    queue("things", "r0001");
    // The user writes again while the server copy is being fetched.
    fake.state.afterGetOne = () => {
      fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(8), deleted: 0, n: "newer" });
      fake.state.outbox.push({ seq: 2, collection: "things", recordId: "r0001" });
    };
    await pushNow();
    expect(fake.table("things").get("r0001")).toMatchObject({ n: "newer" });
    expect(fake.state.outbox).toEqual([{ seq: 2, collection: "things", recordId: "r0001" }]);
    // …and that write wins on the next push.
    await pushNow();
    expect(fake.state.server.get("things")![0]).toMatchObject({ n: "newer" });
  });
});

describe("pull", () => {
  it("does not skip a row when an earlier one is updated between pages (CR-05)", async () => {
    fake.state.server.set("things", Array.from({ length: 250 }, (_, i) => serverRow(i)));
    // Another device edits the first row while the first page is in hand: it
    // moves to the end of the `updated` order, shifting every row after it.
    fake.state.afterList = (name, call) => {
      if (call !== 1) return;
      const rows = fake.state.server.get(name)!;
      rows[0] = { ...rows[0]!, updated: stamp(5000), updatedAt: stamp(5000) };
    };
    await syncNow();
    const local = fake.table("things");
    expect(local.size).toBe(250);
    expect(fake.state.meta.get("cursor:things")).toBe(stamp(5000));
  });

  it("reads the local rows once per page, not once per row (#282)", async () => {
    fake.state.server.set("things", Array.from({ length: 250 }, (_, i) => serverRow(i)));
    // One row already stored as the server has it: not written again.
    fake.table("things").set("r0003", { id: "r0003", updatedAt: stamp(3), deleted: 0 });
    await syncNow();
    expect(fake.state.localGets).toBe(0);
    expect(fake.state.localBulkGets).toBe(2);
    expect(fake.table("things").size).toBe(250);
  });

  it("holds back only the record whose push keeps failing, not the cursor (CR-08)", async () => {
    fake.state.server.set("things", Array.from({ length: 10 }, (_, i) => serverRow(i)));
    // A local edit to r0001, older than the server's, that cannot reach the server yet.
    fake.table("things").set("r0001", { id: "r0001", updatedAt: "2026-01-01", deleted: 0, mine: true });
    fake.state.outbox = [{ seq: 1, collection: "things", recordId: "r0001" }];
    fake.state.failUpdate.add("r0001");

    await syncNow();
    expect(fake.state.meta.get("cursor:things")).toBe(stamp(9));
    expect(fake.table("things").get("r0001")).toMatchObject({ mine: true });
    expect(fake.table("things").size).toBe(10);

    // The push resolves next cycle (the server copy wins); the server copy then
    // still arrives although the cursor is already past it.
    fake.state.failUpdate.clear();
    await syncNow();
    expect(fake.state.outbox).toEqual([]);
    expect(fake.table("things").get("r0001")).toEqual({ id: "r0001", updatedAt: stamp(1), deleted: 0 });
  });
});

describe("when to pull (#274)", () => {
  it("waits 30 s while things move, stretching to 5 minutes when nothing does", () => {
    expect([0, 1, 2, 3, 4, 9].map(nextPullDelay)).toEqual([30_000, 30_000, 60_000, 120_000, 300_000, 300_000]);
  });

  // Last in the file: startSync runs once per module, and its listeners stay.
  it("pulls on a timer while shown, never while hidden, and again on coming back", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
    vi.stubGlobal("window", win);
    vi.stubGlobal("document", doc);
    try {
      startSync();
      await vi.waitFor(() => expect(fake.state.listCalls).toBe(1));
      // Nothing moves: 30 s after that first pull, then a minute, then two.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fake.state.listCalls).toBe(2);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fake.state.listCalls).toBe(2);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fake.state.listCalls).toBe(3);
      await vi.advanceTimersByTimeAsync(119_000);
      expect(fake.state.listCalls).toBe(3);
      await vi.advanceTimersByTimeAsync(1_000);
      expect(fake.state.listCalls).toBe(4);

      // Hidden: the pending pull does nothing and none follows.
      doc.visibilityState = "hidden";
      doc.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(30 * 60_000);
      expect(fake.state.listCalls).toBe(4);
      win.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
      expect(fake.state.listCalls).toBe(4);

      // Shown again: one pull now (focus arriving with it is the same return)…
      doc.visibilityState = "visible";
      doc.dispatchEvent(new Event("visibilitychange"));
      win.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
      expect(fake.state.listCalls).toBe(5);
      // …and back to the short wait.
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fake.state.listCalls).toBe(6);

      // A local write after a quiet stretch brings the 30 s wait back too.
      await vi.advanceTimersByTimeAsync(60_000 + 120_000 + 300_000);
      expect(fake.state.listCalls).toBe(9);
      fake.table("things").set("r0001", { id: "r0001", updatedAt: stamp(1), deleted: 0 });
      fake.state.outbox = [{ seq: 1, collection: "things", recordId: "r0001" }];
      requestSync();
      await vi.advanceTimersByTimeAsync(400);
      expect(fake.state.requests).toEqual(["update things/r0001", "create things/r0001"]);
      expect(fake.state.listCalls).toBe(9);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(fake.state.listCalls).toBe(10);
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
