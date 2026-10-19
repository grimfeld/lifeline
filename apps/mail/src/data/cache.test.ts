import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, initApps } from "@lifeline/core";
import { INBOX, MAIL_CACHE, MAILBOX, type MailCacheRow, type Mailbox, type ThreadRow } from "../domain/types";
import type { GmailThread } from "../domain/mime";
import type { ThreadPage } from "../gmail/api";

// Gmail is faked: each test says what the next list call returns.
const gmail = vi.hoisted(() => ({ page: { threads: [] } as unknown as ThreadPage, threads: new Map<string, unknown>() }));
vi.mock("../gmail/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../gmail/api")>()),
  listThreads: async () => gmail.page,
  getThreadMetadata: async (_address: string, id: string) => gmail.threads.get(id),
}));

const { refreshThreads, searchThreads } = await import("./cache");

initApps([{ id: "mail", title: "Mail", types: [], localTables: [{ name: MAIL_CACHE, indexes: ["kind", "[mailboxId+kind]", "threadId", "date"] }], screens: [], cards: [], commands: [] }]);

const mailbox = { id: "mb1", type: MAILBOX, address: "me@example.com", color: "1" } as Mailbox;
const table = () => db().collection<MailCacheRow>(MAIL_CACHE);

function gmailThread(id: string, date: string, labelIds: string[]): GmailThread {
  return {
    id,
    messages: [{ id: `${id}m`, threadId: id, labelIds, internalDate: String(Date.parse(date)), payload: { headers: [{ name: "Subject", value: id }] } }],
  } as unknown as GmailThread;
}

async function inboxIds(): Promise<string[]> {
  const rows = (await table().toArray()) as ThreadRow[];
  return rows.filter((r) => r.kind === "thread" && r.labelIds.includes(INBOX)).map((r) => r.threadId);
}

beforeEach(async () => {
  await table().clear();
  gmail.threads.clear();
});

describe("an empty list from Gmail (no `threads` field)", () => {
  it("refreshing an emptied Inbox does not throw and drops the Threads cached under it", async () => {
    gmail.threads.set("t1", gmailThread("t1", "2026-09-01T10:00:00Z", [INBOX]));
    gmail.page = { threads: [{ id: "t1" }] };
    await refreshThreads(mailbox, INBOX);
    expect(await inboxIds()).toEqual(["t1"]);

    // Archived elsewhere: Gmail now answers with no `threads` at all.
    gmail.page = { resultSizeEstimate: 0 } as ThreadPage;
    await expect(refreshThreads(mailbox, INBOX)).resolves.toEqual({ nextPageToken: undefined, count: 0 });
    expect(await inboxIds()).toEqual([]);
  });

  it("a search with no results returns an empty list", async () => {
    gmail.page = { resultSizeEstimate: 0 } as ThreadPage;
    await expect(searchThreads(mailbox, "from:nobody")).resolves.toEqual({ threads: [], nextPageToken: undefined });
  });
});
