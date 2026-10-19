/**
 * The Handoff codec (ADR 0080): a Handoff made outside Lifeline travels to the
 * Handoff page in the URL fragment, so it never reaches a server log. Shared by
 * the shell and the Lifeline extension, so it depends on nothing — no React, no
 * Core, no Node — and runs wherever `btoa` and `TextEncoder` do.
 */

/**
 * What one App hands to another's Intake (ADR 0050, CONTEXT.md "Handoff"):
 * a title, a text in markdown, where it came from, who wrote it, when — and
 * nothing the sender would have to know about the receiver.
 */
export interface Handoff {
  title: string;
  /** Markdown. May be empty (a bare title). */
  text: string;
  /** Origin URL, when there is one. */
  url?: string;
  author?: string;
  /** ISO instant or YYYY-MM-DD: when the material was written / sent. */
  date?: string;
  /**
   * The Document it was taken from, when there is one (ADR 0073) — a Note, a
   * Quote, a Thought a passage was selected in. A receiver may keep it as a
   * link; what it says is read through the link, never copied. A Handoff from
   * outside Lifeline never has one, and the codec never carries it.
   */
  originId?: string;
}

/** Where a Handoff from outside Lifeline arrives, its fragment after the `#`. */
export const HANDOFF_PATH = "/handoff";
/** Where the Handoff page goes once the Intake's dialog has saved — the extension closes its window there. */
export const HANDOFF_DONE_PATH = "/handoff/done";

/** Why a fragment could not be read as a Handoff. */
export type HandoffDecodeError =
  /** Nothing after the `#`. */
  | "empty"
  /** Written by a newer (or unknown) codec: `v2.…`. */
  | "version"
  /** Truncated, garbage, or not the shape of a Handoff. */
  | "malformed";

export type HandoffDecoded =
  | { ok: true; handoff: Handoff; /** The Intake the sender named (`appId/intakeId`), when it named one. */ intake?: string }
  | { ok: false; error: HandoffDecodeError };

// v1: "v1." + base64url(UTF-8 JSON of { title, text, url?, author?, date?, intake? }).
const V1 = "v1.";

/** A Handoff (and the Intake it is for, `appId/intakeId`) as a URL-fragment string, without the `#`. */
export function encodeHandoff(handoff: Handoff, intake?: string): string {
  const { title, text, url, author, date } = handoff;
  const json = JSON.stringify({ title, text, url: url || undefined, author: author || undefined, date: date || undefined, intake: intake || undefined });
  return V1 + toBase64Url(new TextEncoder().encode(json));
}

/** The Handoff page's address for a Handoff, on a Lifeline at `origin` ("https://lifeline.example"). */
export function handoffUrl(origin: string, handoff: Handoff, intake?: string): string {
  return `${origin.replace(/\/+$/, "")}${HANDOFF_PATH}#${encodeHandoff(handoff, intake)}`;
}

/** A fragment (with or without its `#`) back to a Handoff. Never throws: what cannot be read is a typed failure. */
export function decodeHandoff(fragment: string): HandoffDecoded {
  const s = String(fragment ?? "").replace(/^#/, "").trim();
  if (!s) return { ok: false, error: "empty" };
  if (!s.startsWith(V1)) return { ok: false, error: /^v\d+\./.test(s) ? "version" : "malformed" };
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(s.slice(V1.length))));
  } catch {
    return { ok: false, error: "malformed" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, error: "malformed" };
  const o = data as Record<string, unknown>;
  if (typeof o.title !== "string" || typeof o.text !== "string") return { ok: false, error: "malformed" };
  for (const k of ["url", "author", "date", "intake"]) if (o[k] !== undefined && typeof o[k] !== "string") return { ok: false, error: "malformed" };
  const handoff: Handoff = { title: o.title, text: o.text };
  if (o.url) handoff.url = o.url as string;
  if (o.author) handoff.author = o.author as string;
  if (o.date) handoff.date = o.date as string;
  return o.intake ? { ok: true, handoff, intake: o.intake as string } : { ok: true, handoff };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  // In slices: a very long text would overflow the argument list of one call.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Throws on anything that is not base64url; the caller turns that into "malformed". */
function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error("not base64url");
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// --- the Android share target (ADR 0080) ---

/** What a share target receives: the manifest's `share_target` sends each, any of which may be missing. */
export interface ShareFields {
  title?: string | null;
  text?: string | null;
  url?: string | null;
}

/** The share sheet's title, text and url as a Handoff. */
export function handoffFromShare(fields: ShareFields): Handoff {
  const title = (fields.title ?? "").trim();
  const text = (fields.text ?? "").trim();
  const url = (fields.url ?? "").trim();
  const shared = url ? { text: text === url ? "" : text, url } : (liftUrl(text) ?? { text });
  const handoff: Handoff = { title: title || hostOf(shared.url) || firstLine(shared.text), text: shared.text };
  if (shared.url) handoff.url = shared.url;
  return handoff;
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

function firstLine(text: string): string {
  return text.split("\n").find((l) => l.trim())?.trim() ?? "";
}

// A URL in shared text: up to whitespace or a bracket, less the punctuation a sentence puts after it.
const URL_IN_TEXT = /https?:\/\/[^\s<>"]+/i;
const TRAILING = /[.,;:!?'")\]}»]+$/;

/** The first URL in the text, and the text without it — the gap closed, its line breaks kept. */
function liftUrl(text: string): { url: string; text: string } | undefined {
  const m = URL_IN_TEXT.exec(text);
  if (!m) return undefined;
  const url = m[0].replace(TRAILING, "");
  const before = text.slice(0, m.index).replace(/[ \t]+$/, "");
  const after = text.slice(m.index + url.length).replace(/^[ \t]+/, "");
  const gap = before && after && !before.endsWith("\n") && !after.startsWith("\n") ? " " : "";
  return { url, text: (before + gap + after).replace(/\n{3,}/g, "\n\n").trim() };
}
