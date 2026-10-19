import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { LifelineDB } from "./db";

it("drops the retired Mail App's local cache from a device that had it (ADR 0080)", async () => {
  // A device last opened under schema 23, while Mail was installed.
  const old = new Dexie("lifeline");
  old.version(23).stores({ _outbox: "++seq, collection", _meta: "key", _mail_cache: "id, updatedAt, deleted, kind" });
  await old.open();
  await old.table("_mail_cache").put({ id: "t1", updatedAt: "", deleted: 0, kind: "thread" });
  old.close();

  const db = new LifelineDB([], []);
  await db.open();
  expect(db.tables.map((t) => t.name)).not.toContain("_mail_cache");
  const idb = db.backendDB();
  expect(Array.from(idb.objectStoreNames)).not.toContain("_mail_cache");
  db.close();
});
