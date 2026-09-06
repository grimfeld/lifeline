import { useMemo } from "react";
import { documentsOf, patchDocument, putDocument, removeDocument, useDocuments } from "@lifeline/core";
import { COLOR_SLOTS } from "@lifeline/ui";
import { MAILBOX, type Mailbox } from "../domain/types";
import { forgetToken, requestToken } from "../gmail/auth";
import { purgeMailboxCache } from "./cache";

function normalize(m: Mailbox): Mailbox {
  return { ...m, address: String(m.address ?? "").toLowerCase(), color: m.color || "blue", tags: m.tags ?? [] };
}

/** Every Mailbox, live, in title order. */
export function useMailboxes(): Mailbox[] {
  const rows = useDocuments<Mailbox>(MAILBOX);
  return useMemo(() => rows.map(normalize).sort((a, b) => a.title.localeCompare(b.title)), [rows]);
}

export function useMailbox(id: string | undefined): Mailbox | undefined {
  return useMailboxes().find((m) => m.id === id);
}

/** The colour slot fewest Mailboxes already wear. */
function nextColor(existing: Mailbox[]): string {
  const used = new Map<string, number>();
  for (const m of existing) used.set(m.color, (used.get(m.color) ?? 0) + 1);
  return [...COLOR_SLOTS].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))[0];
}

/**
 * Connect a Mailbox (CONTEXT.md): Google asks which account, Gmail says
 * which address that is, and a Mailbox Document is made for it — or the one
 * already there is simply signed in on this device. No credential is stored.
 */
export async function connectMailbox(): Promise<{ mailbox: Mailbox; created: boolean }> {
  const { address } = await requestToken({ selectAccount: true });
  const existing = (await documentsOf<Mailbox>(MAILBOX)).map(normalize);
  const found = existing.find((m) => m.address === address);
  if (found) return { mailbox: found, created: false };
  const created = await putDocument<Mailbox>({ type: MAILBOX, title: address, address, color: nextColor(existing), tags: [] });
  return { mailbox: normalize(created), created: true };
}

/** Sign a known Mailbox in again on this device — the Google window, hinted at its address. */
export async function signIn(mailbox: Mailbox): Promise<void> {
  await requestToken({ hint: mailbox.address });
}

/** Forget this device's token. Gmail is untouched. */
export function signOut(mailbox: Mailbox): void {
  forgetToken(mailbox.address);
}

export async function renameMailbox(mailbox: Mailbox, title: string): Promise<void> {
  const t = title.trim();
  if (!t || t === mailbox.title) return;
  await patchDocument(mailbox.id, { title: t });
}

export async function recolorMailbox(mailbox: Mailbox, color: string): Promise<void> {
  await patchDocument(mailbox.id, { color });
}

/** Delete the Mailbox Document and this device's cache of it. Nothing at Google changes. */
export async function removeMailbox(mailbox: Mailbox): Promise<void> {
  forgetToken(mailbox.address);
  await purgeMailboxCache(mailbox.id);
  await removeDocument(mailbox.id);
}
