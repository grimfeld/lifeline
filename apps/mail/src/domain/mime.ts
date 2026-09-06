import type { AttachmentMeta, Message, Party } from "./types";

/** The parts of a Gmail `users.messages` resource the App reads (format=full or metadata). */
export interface GmailHeader {
  name: string;
  value: string;
}
export interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
}

/** Base64url (Gmail's body encoding) → text, honouring the part's charset when it says one. */
export function decodeBody(data: string | undefined, charset = "utf-8"): string {
  if (!data) return "";
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  let bin: string;
  try {
    bin = atob(b64 + pad);
  } catch {
    return "";
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function header(headers: GmailHeader[] | undefined, name: string): string {
  const lower = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === lower)?.value ?? "";
}

function charsetOf(part: GmailPart): string {
  const ct = header(part.headers, "Content-Type");
  const m = /charset="?([\w-]+)"?/i.exec(ct);
  return m ? m[1].toLowerCase() : "utf-8";
}

/** `"Jane Doe" <jane@example.com>, bob@example.com` → parties. */
export function parseParties(value: string): Party[] {
  const out: Party[] = [];
  // Split on commas outside quotes and angle brackets.
  let depth = 0;
  let quoted = false;
  let cur = "";
  const flush = () => {
    const p = parseParty(cur.trim());
    if (p) out.push(p);
    cur = "";
  };
  for (const ch of value) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") depth++;
    else if (!quoted && ch === ">") depth = Math.max(0, depth - 1);
    if (ch === "," && !quoted && depth === 0) flush();
    else cur += ch;
  }
  flush();
  return out;
}

export function parseParty(raw: string): Party | null {
  if (!raw) return null;
  const m = /^(.*?)\s*<([^>]+)>\s*$/.exec(raw);
  if (m) {
    const name = m[1].trim().replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
    return { name: name || m[2].trim(), address: m[2].trim().toLowerCase() };
  }
  const address = raw.replace(/^<|>$/g, "").trim();
  return { name: address, address: address.toLowerCase() };
}

/** Walk a MIME tree: the first text/html and text/plain bodies, and every part with a filename. */
function walk(part: GmailPart | undefined, acc: { html: string; text: string; attachments: AttachmentMeta[] }) {
  if (!part) return;
  const mime = (part.mimeType ?? "").toLowerCase();
  if (part.filename && part.body?.attachmentId) {
    acc.attachments.push({ id: part.body.attachmentId, filename: part.filename, mimeType: mime, size: part.body.size ?? 0 });
  } else if (mime === "text/html" && !acc.html) {
    acc.html = decodeBody(part.body?.data, charsetOf(part));
  } else if (mime === "text/plain" && !acc.text) {
    acc.text = decodeBody(part.body?.data, charsetOf(part));
  }
  for (const p of part.parts ?? []) walk(p, acc);
}

/** A Gmail message resource → the App's Message. Bodies are empty for metadata-only reads. */
export function parseMessage(raw: GmailMessage, mailboxId: string): Message {
  const h = raw.payload?.headers;
  const acc = { html: "", text: "", attachments: [] as AttachmentMeta[] };
  walk(raw.payload, acc);
  const internal = raw.internalDate ? new Date(Number(raw.internalDate)) : null;
  const headerDate = header(h, "Date") ? new Date(header(h, "Date")) : null;
  const date = internal && !Number.isNaN(internal.getTime()) ? internal : headerDate && !Number.isNaN(headerDate.getTime()) ? headerDate : new Date(0);
  return {
    id: raw.id,
    threadId: raw.threadId,
    mailboxId,
    subject: header(h, "Subject"),
    from: parseParties(header(h, "From"))[0] ?? { name: "", address: "" },
    to: parseParties(header(h, "To")),
    cc: parseParties(header(h, "Cc")),
    date: date.toISOString(),
    labelIds: raw.labelIds ?? [],
    snippet: decodeEntities(raw.snippet ?? ""),
    html: acc.html,
    text: acc.text,
    attachments: acc.attachments,
  };
}

/** Gmail's snippets are HTML-escaped text. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** A `users.threads` resource (any format). */
export interface GmailThread {
  id: string;
  historyId?: string;
  snippet?: string;
  messages?: GmailMessage[];
}

export interface ThreadSummary {
  subject: string;
  snippet: string;
  from: Party[];
  date: string;
  labelIds: string[];
  unread: boolean;
  starred: boolean;
  messageCount: number;
}

/** Fold a thread's messages into the row the list shows: the subject of the first, the newest date, the union of labels. */
export function summarizeThread(t: GmailThread, mailboxId: string): ThreadSummary {
  const msgs = (t.messages ?? []).map((m) => parseMessage(m, mailboxId)).sort((a, b) => a.date.localeCompare(b.date));
  const labels = new Set<string>();
  const from: Party[] = [];
  const seen = new Set<string>();
  for (const m of msgs) {
    for (const l of m.labelIds) labels.add(l);
    if (m.from.address && !seen.has(m.from.address)) {
      seen.add(m.from.address);
      from.push(m.from);
    }
  }
  const newest = msgs[msgs.length - 1];
  return {
    subject: msgs.find((m) => m.subject)?.subject ?? "",
    snippet: newest?.snippet ?? decodeEntities(t.snippet ?? ""),
    from,
    date: newest?.date ?? new Date(0).toISOString(),
    labelIds: [...labels],
    unread: labels.has("UNREAD"),
    starred: labels.has("STARRED"),
    messageCount: msgs.length,
  };
}
