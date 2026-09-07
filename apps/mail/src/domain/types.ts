import type { Document, SyncedRecord } from "@lifeline/core";

export const APP_ID = "mail";
/** The one Document type Mail owns (ADR 0051). */
export const MAILBOX = "mailbox";
/** Local-only (never synced) cache of Threads, Messages and Labels read from Gmail. */
export const MAIL_CACHE = "_mail_cache";
export const MAIL_HREF = "/app/mail";
export const MAIL_COLOR = "var(--chart-yellow)";

/** The Mailbox switcher's merged view: every signed-in Mailbox at once. */
export const ALL = "all";

/** Gmail's own label ids the App relies on. */
export const INBOX = "INBOX";
export const STARRED = "STARRED";
export const UNREAD = "UNREAD";
export const TRASH = "TRASH";
export const SPAM = "SPAM";

/** Threads fetched per page of the list. */
export const PAGE_SIZE = 50;
/** How often an open list or Card re-reads Gmail, while a token is still valid. */
export const REFRESH_MS = 3 * 60_000;

/**
 * A Mailbox (CONTEXT.md): one connected Gmail address. Lifeline stores no
 * credential for it — a device reads it while it holds a Google sign-in.
 */
export interface Mailbox extends Document {
  type: typeof MAILBOX;
  /** The Gmail address — the Mailbox's identity, fixed at connect (guarded). */
  address: string;
  /** One of the eight colour slots. */
  color: string;
}

export interface Party {
  name: string;
  address: string;
}

/** One Gmail conversation as listed and triaged (CONTEXT.md "Thread"). Not a Document. */
export interface Thread {
  id: string;
  mailboxId: string;
  subject: string;
  snippet: string;
  /** Distinct senders, oldest first. */
  from: Party[];
  /** ISO instant of the newest message. */
  date: string;
  /** Union of the messages' Gmail label ids. */
  labelIds: string[];
  unread: boolean;
  starred: boolean;
  messageCount: number;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** One email inside a Thread (CONTEXT.md "Message"). Not a Document. */
export interface Message {
  id: string;
  threadId: string;
  mailboxId: string;
  subject: string;
  from: Party;
  to: Party[];
  cc: Party[];
  /** ISO instant. */
  date: string;
  labelIds: string[];
  snippet: string;
  /** The HTML body, when there is one (unsanitised — sanitise at render). */
  html: string;
  /** The plain-text body, when there is one. */
  text: string;
  attachments: AttachmentMeta[];
}

/** A Gmail label as read (CONTEXT.md "Label"). */
export interface Label {
  id: string;
  name: string;
  type: "system" | "user";
  /** Only known after a counts read (INBOX). */
  threadsUnread?: number;
}

/** Rows of `_mail_cache`, discriminated by `kind`. */
export type MailCacheRow = ThreadRow | MessageRow | LabelRow;

export interface ThreadRow extends SyncedRecord, Thread {
  /** `t:<mailboxId>:<threadId>` */
  id: string;
  kind: "thread";
  /** The Gmail thread id (`id` is the row key). */
  threadId: string;
  fetchedAt: string;
}

export interface MessageRow extends SyncedRecord, Message {
  /** `m:<mailboxId>:<messageId>` */
  id: string;
  kind: "message";
  messageId: string;
  fetchedAt: string;
}

export interface LabelRow extends SyncedRecord, Label {
  /** `l:<mailboxId>:<labelId>` */
  id: string;
  kind: "label";
  mailboxId: string;
  labelId: string;
  fetchedAt: string;
}

export const threadRowId = (mailboxId: string, threadId: string) => `t:${mailboxId}:${threadId}`;
export const messageRowId = (mailboxId: string, messageId: string) => `m:${mailboxId}:${messageId}`;
export const labelRowId = (mailboxId: string, labelId: string) => `l:${mailboxId}:${labelId}`;

/** Where a Thread opens in Gmail itself — reply, compose and everything Mail does not do. */
export function gmailThreadUrl(address: string, threadId: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(address)}#all/${threadId}`;
}

/** The Mail screen with a Mailbox (or All) and optionally a Thread selected. */
export function mailHref(mailboxId: string = ALL, threadId?: string): string {
  const q = new URLSearchParams({ mailbox: mailboxId });
  if (threadId) q.set("thread", threadId);
  return `${MAIL_HREF}?${q}`;
}

/** Labels the merged All view can narrow by — the ones every Mailbox has. */
export const ALL_LABELS: Label[] = [
  { id: INBOX, name: "Inbox", type: "system" },
  { id: STARRED, name: "Starred", type: "system" },
  { id: UNREAD, name: "Unread", type: "system" },
];

/** Gmail's system labels worth listing, in this order; the rest are hidden bookkeeping (CATEGORY_*, CHAT…). */
export const SYSTEM_LABEL_ORDER = [INBOX, STARRED, UNREAD, "IMPORTANT", "SENT", "DRAFT", TRASH, SPAM];
export const SYSTEM_LABEL_NAME: Record<string, string> = {
  INBOX: "Inbox",
  STARRED: "Starred",
  UNREAD: "Unread",
  IMPORTANT: "Important",
  SENT: "Sent",
  DRAFT: "Drafts",
  TRASH: "Trash",
  SPAM: "Spam",
};
