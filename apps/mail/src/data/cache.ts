import { useEffect, useMemo, useRef, useState } from "react";
import { db, useLiveQuery } from "@lifeline/core";
import {
  ALL_LABELS,
  INBOX,
  MAIL_CACHE,
  PAGE_SIZE,
  REFRESH_MS,
  STARRED,
  SYSTEM_LABEL_NAME,
  SYSTEM_LABEL_ORDER,
  UNREAD,
  labelRowId,
  messageRowId,
  threadRowId,
  type Label,
  type LabelRow,
  type Mailbox,
  type MailCacheRow,
  type Message,
  type MessageRow,
  type Thread,
  type ThreadRow,
} from "../domain/types";
import { parseMessage, summarizeThread } from "../domain/mime";
import { getLabel, getThreadFull, getThreadMetadata, listLabels, listThreads, mapLimit, modifyThread, trashThread, SignedOutError } from "../gmail/api";
import { isSignedIn } from "../gmail/auth";

/**
 * The local-only cache (ADR 0047): what this device last read from Gmail,
 * so the list and opened Threads render instantly and offline. Never synced,
 * never a truth of its own — every write here follows a read from, or a
 * write to, Google.
 */
function table() {
  return db().collection<MailCacheRow>(MAIL_CACHE);
}
const now = () => new Date().toISOString();

/* ---------- Threads ---------- */

function threadOf(row: ThreadRow): Thread {
  return {
    id: row.threadId,
    mailboxId: row.mailboxId,
    subject: row.subject,
    snippet: row.snippet,
    from: row.from,
    date: row.date,
    labelIds: row.labelIds,
    unread: row.unread,
    starred: row.starred,
    messageCount: row.messageCount,
  };
}

/** Does a cached Thread belong under this Label? UNREAD and STARRED are labels in Gmail too. */
function hasLabel(t: Thread, labelId: string): boolean {
  return t.labelIds.includes(labelId);
}

async function threadRows(mailboxIds: string[]): Promise<ThreadRow[]> {
  if (mailboxIds.length === 0) return [];
  const rows = await table()
    .where("[mailboxId+kind]")
    .anyOf(mailboxIds.map((id) => [id, "thread"]))
    .toArray();
  return rows as ThreadRow[];
}

/** Live: the cached Threads of these Mailboxes under one Label, newest first. */
export function useCachedThreads(mailboxIds: string[], labelId: string): Thread[] {
  const key = mailboxIds.join(",");
  const rows = useLiveQuery(() => threadRows(mailboxIds), [key], [] as ThreadRow[]);
  return useMemo(
    () =>
      rows
        .map(threadOf)
        .filter((t) => hasLabel(t, labelId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [rows, labelId],
  );
}

export function useCachedThread(mailboxId: string | undefined, threadId: string | undefined): Thread | undefined {
  const row = useLiveQuery(async () => (mailboxId && threadId ? await table().get(threadRowId(mailboxId, threadId)) : undefined), [mailboxId, threadId]);
  return row && row.kind === "thread" ? threadOf(row) : undefined;
}

async function upsertThreadRows(mailboxId: string, summaries: { threadId: string; summary: ReturnType<typeof summarizeThread> }[]): Promise<void> {
  const fetchedAt = now();
  const rows: ThreadRow[] = summaries.map(({ threadId, summary }) => ({
    id: threadRowId(mailboxId, threadId),
    updatedAt: fetchedAt,
    deleted: 0,
    kind: "thread",
    threadId,
    mailboxId,
    fetchedAt,
    ...summary,
  }));
  await table().bulkPut(rows);
}

/**
 * Read one page of a Label's Threads from Gmail into the cache. On the first
 * page the cache is reconciled: a cached Thread newer than the oldest one
 * fetched that Gmail no longer lists under the Label lost it elsewhere
 * (archived in Gmail, read on the phone) and drops it here too.
 */
export async function refreshThreads(mailbox: Mailbox, labelId: string, pageToken?: string): Promise<{ nextPageToken?: string; count: number }> {
  const page = await listThreads(mailbox.address, { labelIds: [labelId], pageToken, maxResults: PAGE_SIZE });
  const ids = page.threads.map((t) => t.id);
  const full = await mapLimit(ids, 6, (id) => getThreadMetadata(mailbox.address, id));
  const summaries = full.map((t) => ({ threadId: t.id, summary: summarizeThread(t, mailbox.id) }));
  await upsertThreadRows(mailbox.id, summaries);
  if (!pageToken) {
    const oldest = summaries.reduce((min, s) => (s.summary.date < min ? s.summary.date : min), now());
    const listed = new Set(ids);
    const cached = (await threadRows([mailbox.id])).filter((r) => r.labelIds.includes(labelId) && r.date >= oldest && !listed.has(r.threadId));
    if (cached.length) {
      await table().bulkPut(cached.map((r) => withLabels(r, [], [labelId])));
    }
  }
  return { nextPageToken: page.nextPageToken, count: ids.length };
}

/** Gmail search (CONTEXT.md): the query as typed, in Gmail's syntax. Results are cached like any Thread and returned in Gmail's order. */
export async function searchThreads(mailbox: Mailbox, q: string, pageToken?: string): Promise<{ threads: Thread[]; nextPageToken?: string }> {
  const page = await listThreads(mailbox.address, { q, pageToken, maxResults: PAGE_SIZE });
  const ids = page.threads.map((t) => t.id);
  const full = await mapLimit(ids, 6, (id) => getThreadMetadata(mailbox.address, id));
  const summaries = full.map((t) => ({ threadId: t.id, summary: summarizeThread(t, mailbox.id) }));
  await upsertThreadRows(mailbox.id, summaries);
  return {
    threads: summaries.map(({ threadId, summary }) => ({ id: threadId, mailboxId: mailbox.id, ...summary })),
    nextPageToken: page.nextPageToken,
  };
}

/* ---------- Messages ---------- */

function messageOf(row: MessageRow): Message {
  return {
    id: row.messageId,
    threadId: row.threadId,
    mailboxId: row.mailboxId,
    subject: row.subject,
    from: row.from,
    to: row.to,
    cc: row.cc,
    date: row.date,
    labelIds: row.labelIds,
    snippet: row.snippet,
    html: row.html,
    text: row.text,
    attachments: row.attachments,
  };
}

/** Live: the cached Messages of one Thread, oldest first. Empty until the Thread was opened once. */
export function useCachedMessages(mailboxId: string | undefined, threadId: string | undefined): Message[] {
  const rows = useLiveQuery(
    async () => (mailboxId && threadId ? ((await table().where("threadId").equals(threadId).toArray()) as MessageRow[]).filter((r) => r.kind === "message" && r.mailboxId === mailboxId) : []),
    [mailboxId, threadId],
    [] as MessageRow[],
  );
  return useMemo(() => rows.map(messageOf).sort((a, b) => a.date.localeCompare(b.date)), [rows]);
}

/** Open a Thread: its Messages in full, into the cache; the Thread row is refreshed from the same read. */
export async function loadThread(mailbox: Mailbox, threadId: string): Promise<void> {
  const t = await getThreadFull(mailbox.address, threadId);
  const fetchedAt = now();
  const rows: MessageRow[] = (t.messages ?? []).map((m) => {
    const parsed = parseMessage(m, mailbox.id);
    return { ...parsed, id: messageRowId(mailbox.id, parsed.id), updatedAt: fetchedAt, deleted: 0, kind: "message", messageId: parsed.id, fetchedAt };
  });
  await table().bulkPut(rows);
  await upsertThreadRows(mailbox.id, [{ threadId, summary: summarizeThread(t, mailbox.id) }]);
}

/* ---------- Labels ---------- */

function labelOf(row: LabelRow): Label {
  return { id: row.labelId, name: row.name, type: row.type, threadsUnread: row.threadsUnread };
}

/** Sort: the system labels in their fixed order, then the user's own by name. */
export function sortLabels(labels: Label[]): Label[] {
  const rank = (l: Label) => {
    const i = SYSTEM_LABEL_ORDER.indexOf(l.id);
    return i === -1 ? SYSTEM_LABEL_ORDER.length : i;
  };
  return labels
    .filter((l) => l.type === "user" || SYSTEM_LABEL_ORDER.includes(l.id))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Live: one Mailbox's cached Labels, sorted; the three shared ones until anything was read. */
export function useCachedLabels(mailboxId: string | undefined): Label[] {
  const rows = useLiveQuery(
    async () => (mailboxId ? ((await table().where("[mailboxId+kind]").equals([mailboxId, "label"]).toArray()) as LabelRow[]) : []),
    [mailboxId],
    [] as LabelRow[],
  );
  return useMemo(() => (rows.length ? sortLabels(rows.map(labelOf)) : ALL_LABELS), [rows]);
}

/** Read the Label list and the Inbox's unread count into the cache. */
export async function refreshLabels(mailbox: Mailbox): Promise<void> {
  const [labels, inbox] = await Promise.all([listLabels(mailbox.address), getLabel(mailbox.address, INBOX).catch(() => undefined)]);
  const fetchedAt = now();
  const rows: LabelRow[] = labels
    .filter((l) => l.type === "user" ? l.labelListVisibility !== "labelHide" : true)
    .map((l) => ({
      id: labelRowId(mailbox.id, l.id),
      updatedAt: fetchedAt,
      deleted: 0,
      kind: "label",
      mailboxId: mailbox.id,
      labelId: l.id,
      name: l.type === "system" ? (SYSTEM_LABEL_NAME[l.id] ?? l.name) : l.name,
      type: l.type,
      threadsUnread: l.id === INBOX ? inbox?.threadsUnread : undefined,
      fetchedAt,
    }));
  const keep = new Set(rows.map((r) => r.id));
  const stale = ((await table().where("[mailboxId+kind]").equals([mailbox.id, "label"]).toArray()) as LabelRow[]).filter((r) => !keep.has(r.id));
  await db().transaction("rw", table(), async () => {
    await table().bulkPut(rows);
    if (stale.length) await table().bulkDelete(stale.map((r) => r.id));
  });
}

/** Live: the Inbox unread count of these Mailboxes, summed from the last Label read (undefined until one happened). */
export function useUnreadCount(mailboxIds: string[]): number | undefined {
  const key = mailboxIds.join(",");
  const rows = useLiveQuery(
    async () => (mailboxIds.length ? await table().bulkGet(mailboxIds.map((id) => labelRowId(id, INBOX))) : []),
    [key],
    [] as (MailCacheRow | undefined)[],
  );
  const known = rows.filter((r): r is LabelRow => !!r && r.kind === "label" && r.threadsUnread !== undefined);
  if (known.length === 0) return undefined;
  return known.reduce((n, r) => n + (r.threadsUnread ?? 0), 0);
}

/* ---------- Triage ---------- */

function withLabels(row: ThreadRow, add: string[], remove: string[]): ThreadRow {
  const set = new Set(row.labelIds);
  remove.forEach((l) => set.delete(l));
  add.forEach((l) => set.add(l));
  const labelIds = [...set];
  return { ...row, labelIds, unread: set.has(UNREAD), starred: set.has(STARRED), updatedAt: now() };
}

/** Write to Gmail, then mirror the same change onto the cached Thread and its Messages. Nothing is queued: offline it throws and changes nothing. */
async function modify(mailbox: Mailbox, threadId: string, add: string[], remove: string[]): Promise<void> {
  await modifyThread(mailbox.address, threadId, add, remove);
  await mirror(mailbox.id, threadId, add, remove);
}

async function mirror(mailboxId: string, threadId: string, add: string[], remove: string[]): Promise<void> {
  const row = await table().get(threadRowId(mailboxId, threadId));
  const msgs = ((await table().where("threadId").equals(threadId).toArray()) as MessageRow[]).filter((r) => r.kind === "message" && r.mailboxId === mailboxId);
  await db().transaction("rw", table(), async () => {
    if (row && row.kind === "thread") await table().put(withLabels(row, add, remove));
    for (const m of msgs) {
      const set = new Set(m.labelIds);
      remove.forEach((l) => set.delete(l));
      add.forEach((l) => set.add(l));
      await table().put({ ...m, labelIds: [...set], updatedAt: now() });
    }
  });
}

export const archive = (mailbox: Mailbox, threadId: string) => modify(mailbox, threadId, [], [INBOX]);
export const moveToInbox = (mailbox: Mailbox, threadId: string) => modify(mailbox, threadId, [INBOX], []);
export const setRead = (mailbox: Mailbox, threadId: string, read: boolean) => modify(mailbox, threadId, read ? [] : [UNREAD], read ? [UNREAD] : []);
export const setStarred = (mailbox: Mailbox, threadId: string, on: boolean) => modify(mailbox, threadId, on ? [STARRED] : [], on ? [] : [STARRED]);
export const setLabel = (mailbox: Mailbox, threadId: string, labelId: string, on: boolean) => modify(mailbox, threadId, on ? [labelId] : [], on ? [] : [labelId]);

/** Gmail's thirty-day bin: the Thread leaves every list it was in. */
export async function trash(mailbox: Mailbox, threadId: string): Promise<void> {
  await trashThread(mailbox.address, threadId);
  const row = await table().get(threadRowId(mailbox.id, threadId));
  if (row && row.kind === "thread") await table().put(withLabels(row, ["TRASH"], [INBOX, UNREAD, STARRED, ...row.labelIds.filter((l) => l !== "TRASH")]));
}

/* ---------- Housekeeping ---------- */

/** Everything this device cached for a Mailbox (on delete). */
export async function purgeMailboxCache(mailboxId: string): Promise<void> {
  const rows = await table()
    .where("[mailboxId+kind]")
    .anyOf([
      [mailboxId, "thread"],
      [mailboxId, "message"],
      [mailboxId, "label"],
    ])
    .primaryKeys();
  if (rows.length) await table().bulkDelete(rows as string[]);
}

/** Newest `fetchedAt` among these Mailboxes' Thread rows — "last read" for the stale marker. */
export function useLastRead(mailboxIds: string[]): string | undefined {
  const key = mailboxIds.join(",");
  return useLiveQuery(
    async () => {
      const rows = await threadRows(mailboxIds);
      return rows.reduce<string | undefined>((max, r) => (!max || r.fetchedAt > max ? r.fetchedAt : max), undefined);
    },
    [key],
  );
}

/* ---------- Periodic refresh ---------- */

export interface ListState {
  loading: boolean;
  error: string | null;
  /** Mailbox ids whose token has lapsed. */
  signedOut: string[];
  /** Per Mailbox: the token for the next page, when there is one. */
  more: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Keep a Label's list current for these Mailboxes: read on mount, on a
 * change of Label or Mailboxes, and on the period — only while a token is
 * still valid. Never asks Google for one: a signed-out Mailbox is reported,
 * not prompted (ADR 0047).
 */
export function useListRefresh(mailboxes: Mailbox[], labelId: string, enabled = true): ListState {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState<string[]>([]);
  const tokens = useRef(new Map<string, string | undefined>());
  const [more, setMore] = useState(false);
  const key = mailboxes.map((m) => m.id).join(",");

  async function run(loadMore: boolean) {
    if (!enabled || mailboxes.length === 0) return;
    setLoading(true);
    setError(null);
    const out: string[] = [];
    try {
      await Promise.all(
        mailboxes.map(async (m) => {
          if (!isSignedIn(m.address)) return void out.push(m.id);
          const token = loadMore ? tokens.current.get(m.id) : undefined;
          if (loadMore && !token) return;
          try {
            const r = await refreshThreads(m, labelId, token);
            tokens.current.set(m.id, r.nextPageToken);
            if (!loadMore) void refreshLabels(m).catch(() => undefined);
          } catch (e) {
            if (e instanceof SignedOutError) out.push(m.id);
            else throw e;
          }
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSignedOut(out);
      setMore([...tokens.current.values()].some(Boolean));
      setLoading(false);
    }
  }

  useEffect(() => {
    tokens.current = new Map();
    setMore(false);
    void run(false);
    const t = setInterval(() => void run(false), REFRESH_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, labelId, enabled]);

  return { loading, error, signedOut, more, loadMore: () => run(true), refresh: () => run(false) };
}
