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
    failGetOne: new Set<string>(),
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
      get: async (id: string) => fake.table(name).get(id),
      put: async (r: Row) => void fake.table(name).set(r.id, r),
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

vi.mock("../documents/registry", () => ({ documentTypeSync: () => undefined }));

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
            const u = params.u ?? params.c;
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
        if (fake.state.failGetOne.has(id)) throw Object.assign(new Error("server error"), { status: 500 });
        const r = (fake.state.server.get(name) ?? []).find((x) => x.id === id);
        if (!r) throw Object.assign(new Error("not found"), { status: 404 });
        return r;
      },
      update: async () => ({}),
      create: async () => ({}),
    }),
  },
}));

const { syncNow } = await import("./sync");

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
  fake.state.failGetOne.clear();
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

describe("pull", () => {
  it("does not skip a row when an earlier one is updated between pages (CR-05)", async () => {
    fake.state.server.set("things", Array.from({ length: 250 }, (_, i) => serverRow(i)));
    // Another device edits the first row while the first page is in hand: it
    // moves to the end of the `updated` order, shifting every row after it.
    fake.state.afterList = (name, call) => {
      if (call !== 1) return;
      const rows = fake.state.server.get(name)!;
      rows[0] = { ...rows[0], updated: stamp(5000), updatedAt: stamp(5000) };
    };
    await syncNow();
    const local = fake.table("things");
    expect(local.size).toBe(250);
    expect(fake.state.meta.get("cursor:things")).toBe(stamp(5000));
  });

  it("holds back only the record whose push keeps failing, not the cursor (CR-08)", async () => {
    fake.state.server.set("things", Array.from({ length: 10 }, (_, i) => serverRow(i)));
    // A local edit to r0001, older than the server's, that cannot reach the server yet.
    fake.table("things").set("r0001", { id: "r0001", updatedAt: "2026-01-01", deleted: 0, mine: true });
    fake.state.outbox = [{ seq: 1, collection: "things", recordId: "r0001" }];
    fake.state.failGetOne.add("r0001");

    await syncNow();
    expect(fake.state.meta.get("cursor:things")).toBe(stamp(9));
    expect(fake.table("things").get("r0001")).toMatchObject({ mine: true });
    expect(fake.table("things").size).toBe(10);

    // The push resolves next cycle (the server copy wins); the server copy then
    // still arrives although the cursor is already past it.
    fake.state.failGetOne.clear();
    await syncNow();
    expect(fake.state.outbox).toEqual([]);
    expect(fake.table("things").get("r0001")).toEqual({ id: "r0001", updatedAt: stamp(1), deleted: 0 });
  });
});
