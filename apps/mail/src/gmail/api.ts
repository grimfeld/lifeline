import { forgetToken, tokenFor } from "./auth";
import type { GmailMessage, GmailThread } from "../domain/mime";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export class SignedOutError extends Error {
  constructor(public address: string) {
    super(`${address} is signed out on this device`);
  }
}

async function call<T>(address: string, path: string, init: RequestInit = {}, query?: Record<string, string | string[] | undefined>): Promise<T> {
  const token = tokenFor(address);
  if (!token) throw new SignedOutError(address);
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(k, x));
    else q.set(k, v);
  }
  const url = `${BASE}/${path}${q.size ? `?${q}` : ""}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers ?? {}) } });
  } catch {
    throw new Error("Gmail could not be reached — offline? Nothing changed.");
  }
  if (res.status === 401) {
    forgetToken(address);
    throw new SignedOutError(address);
  }
  if (!res.ok) {
    let msg = `Gmail HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      if (j.error?.message) msg = j.error.message;
    } catch {
      /* keep */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ThreadPage {
  threads: { id: string; snippet?: string; historyId?: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

/** One page of thread ids for a label and/or a query. Spam and trash are left out unless asked by label. */
export function listThreads(address: string, opts: { labelIds?: string[]; q?: string; pageToken?: string; maxResults: number }): Promise<ThreadPage> {
  return call<ThreadPage>(address, "threads", {}, { labelIds: opts.labelIds, q: opts.q, pageToken: opts.pageToken, maxResults: String(opts.maxResults) });
}

const METADATA_HEADERS = ["From", "To", "Subject", "Date"];

/** A thread's messages with headers only — what the list needs. */
export function getThreadMetadata(address: string, id: string): Promise<GmailThread> {
  return call<GmailThread>(address, `threads/${id}`, {}, { format: "metadata", metadataHeaders: METADATA_HEADERS });
}

/** A thread's messages in full — bodies and attachment parts. */
export function getThreadFull(address: string, id: string): Promise<GmailThread> {
  return call<GmailThread>(address, `threads/${id}`, {}, { format: "full" });
}

export function getMessageFull(address: string, id: string): Promise<GmailMessage> {
  return call<GmailMessage>(address, `messages/${id}`, {}, { format: "full" });
}

/** Triage (CONTEXT.md): add and remove labels on every message of the thread — archive, read, star, label. */
export function modifyThread(address: string, id: string, add: string[], remove: string[]): Promise<GmailThread> {
  return call<GmailThread>(address, `threads/${id}/modify`, { method: "POST", body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }) });
}

export function trashThread(address: string, id: string): Promise<GmailThread> {
  return call<GmailThread>(address, `threads/${id}/trash`, { method: "POST" });
}

export function untrashThread(address: string, id: string): Promise<GmailThread> {
  return call<GmailThread>(address, `threads/${id}/untrash`, { method: "POST" });
}

export interface GmailLabel {
  id: string;
  name: string;
  type: "system" | "user";
  messagesUnread?: number;
  threadsUnread?: number;
  threadsTotal?: number;
  labelListVisibility?: string;
}

export async function listLabels(address: string): Promise<GmailLabel[]> {
  const r = await call<{ labels?: GmailLabel[] }>(address, "labels");
  return r.labels ?? [];
}

/** One label with its counts (labels.list carries none). */
export function getLabel(address: string, id: string): Promise<GmailLabel> {
  return call<GmailLabel>(address, `labels/${id}`);
}

/** Run `fn` over items with at most `limit` in flight — the metadata reads behind a list page. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
