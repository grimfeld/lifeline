import { db } from "./db";
import { pb } from "./pb";
import { isDemo } from "../demo";

/**
 * One device holds one Account's data at a time (CONTEXT.md "Account",
 * ADR 0039). The local database is bound to the first Account that syncs
 * through it; a different sign-in is a conflict the sync engine refuses
 * until the user either signs back in as the bound Account or erases the
 * device's local data and starts over.
 */

const ACCOUNT_ID_KEY = "account";
const ACCOUNT_EMAIL_KEY = "accountEmail";

export interface AccountRef {
  id: string;
  email: string;
}

/** The signed-in Account, if any. */
export function currentAccount(): AccountRef | undefined {
  // A Demo device is bound to no Account (CONTEXT.md "Demo"), whatever the browser remembers.
  if (isDemo()) return undefined;
  const r = pb.authStore.record as { id: string; email?: string } | null;
  return pb.authStore.isValid && r ? { id: r.id, email: r.email ?? "" } : undefined;
}

/** The Account this device's local data belongs to — set by the first sync, cleared only by switchAccount(). */
export async function boundAccount(): Promise<AccountRef | undefined> {
  const id = (await db()._meta.get(ACCOUNT_ID_KEY))?.value;
  if (!id) return undefined;
  return { id, email: (await db()._meta.get(ACCOUNT_EMAIL_KEY))?.value ?? "" };
}

export async function bindAccount(a: AccountRef): Promise<void> {
  await db()._meta.bulkPut([
    { key: ACCOUNT_ID_KEY, value: a.id },
    { key: ACCOUNT_EMAIL_KEY, value: a.email },
  ]);
}

/** Set when someone other than the bound Account is signed in. */
export async function accountConflict(): Promise<{ bound: AccountRef; current: AccountRef } | undefined> {
  const current = currentAccount();
  if (!current) return undefined;
  const bound = await boundAccount();
  return bound && bound.id !== current.id ? { bound, current } : undefined;
}

/** Local writes the bound Account has not pushed yet — erasing the device would lose them. */
export async function pendingWriteCount(): Promise<number> {
  return db()._outbox.count();
}

/**
 * Erase everything this device holds locally and reload, so the signed-in
 * Account starts from a clean pull. The server keeps every record; only
 * unpushed local writes would be lost, which callers check first.
 */
export async function switchAccount(): Promise<void> {
  await db().delete();
  location.reload();
}
