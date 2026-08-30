import type { Table } from "dexie";
import { ATTACHMENTS, BLOBS, db, type SyncedRecord } from "./data/db";
import { sharedLiveQuery } from "./data/live";
import { pb } from "./data/pb";
import { put, remove } from "./data/repo";
import { newId } from "./ids";
import { extractLinks, isImageEmbed, normalizeName, renameLinks } from "./markdown";
import { allDocuments, putDocument } from "./documents/store";
import { privateGate } from "./private";
import type { Document } from "./documents/types";

/**
 * Attachments (ADR 0037, CONTEXT.md "Attachment"): images dropped or pasted
 * into a body, kept by Core beside the content. Not Documents — a synced
 * metadata record here, the bytes in the local `_blobs` table and in a
 * protected PocketBase file. A body embeds one by name: `![[name.png]]`.
 */
export interface Attachment extends SyncedRecord {
  /** The identity bodies embed by — unique across Attachments, compared like Wikilink names. */
  name: string;
  mime: string;
  size: number;
  /** The server's filename once uploaded (PocketBase renames on store); absent until the push lands. */
  file?: string;
}

export interface BlobRow {
  id: string;
  blob: Blob;
}

/** Hard ceiling after downscaling; the PocketBase field enforces the same. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** Longest edge kept, in px. A note is not a photo library. */
export const MAX_IMAGE_EDGE = 2048;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/bmp": "bmp",
};

/** What an image of this mime is called on disk ("jpg" for JPEG). */
export function extensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? "png";
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** Characters that would break `![[…]]` (or a path) are replaced by a dash. */
export function sanitizeAttachmentName(name: string): string {
  return name.replace(/[\\/:*?"<>|[\]#^]/g, "-").replace(/\s+/g, " ").trim();
}

/**
 * The name a new Attachment gets (Obsidian's rule): a dropped file keeps its
 * stem, a pasted image is `Pasted image YYYYMMDDHHmmss`; the extension is the
 * stored bytes' own (a HEIC re-encoded as JPEG ends in .jpg). A taken name
 * gets ` 1`, ` 2`… — `taken` compares however the caller does (normalised).
 */
export function attachmentName(original: string | undefined, ext: string, taken: (name: string) => boolean, now = new Date()): string {
  const stemOf = (s: string) => s.replace(/\.[A-Za-z0-9]+$/, "");
  const fallback = `Pasted image ${stamp(now)}`;
  const stem = original?.trim() ? sanitizeAttachmentName(stemOf(original.trim())) || fallback : fallback;
  let candidate = `${stem}.${ext}`;
  for (let i = 1; taken(candidate); i++) candidate = `${stem} ${i}.${ext}`;
  return candidate;
}

/** The Attachment a written name stands for: names compare like Wikilinks; ties go to the oldest. */
export function resolveAttachment(list: readonly Attachment[], name: string): Attachment | undefined {
  const k = normalizeName(name);
  let best: Attachment | undefined;
  for (const a of list) {
    if (a.deleted || normalizeName(a.name) !== k) continue;
    if (!best || a.updatedAt < best.updatedAt) best = a;
  }
  return best;
}

/** Normalised names of every Attachment embedded by these bodies. */
export function embeddedNames(bodies: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const body of bodies) {
    if (!body) continue;
    for (const l of extractLinks(body)) if (isImageEmbed(l)) out.add(normalizeName(l.name));
  }
  return out;
}

/** The Attachments no body embeds any more (CONTEXT.md: orphaned). Pure. */
export function orphanedAmong(attachments: readonly Attachment[], docs: readonly Pick<Document, "body">[]): Attachment[] {
  const used = embeddedNames(docs.map((d) => (typeof d.body === "string" ? d.body : "")));
  return attachments.filter((a) => !a.deleted && !used.has(normalizeName(a.name)));
}

// --- store ---------------------------------------------------------------------

export async function allAttachments(): Promise<Attachment[]> {
  return db().collection<Attachment>(ATTACHMENTS).where("deleted").equals(0).toArray();
}

const allLive = sharedLiveQuery(() => allAttachments(), [] as Attachment[]);

/** React hook: every live Attachment. One shared query. */
export function useAttachments(): Attachment[] {
  return allLive.use();
}

function blobs(): Table<BlobRow, string> {
  return db().table(BLOBS) as Table<BlobRow, string>;
}

/**
 * Downscale an image for storage: ≤ MAX_IMAGE_EDGE on the long edge; photos
 * (JPEG, WebP, anything else) re-encoded as JPEG q0.85, PNG kept as PNG
 * (screenshots) and only resized when too big; GIF and SVG untouched. An
 * image the browser cannot decode is kept as it came.
 */
export async function prepareImage(file: Blob): Promise<{ blob: Blob; mime: string }> {
  const mime = file.type;
  if (mime === "image/gif" || mime === "image/svg+xml") return { blob: file, mime };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return { blob: file, mime };
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bmp.width, bmp.height));
    const png = mime === "image/png";
    if (png && scale === 1) return { blob: file, mime };
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { blob: file, mime };
    ctx.drawImage(bmp, 0, 0, w, h);
    const outMime = png ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, outMime, png ? undefined : 0.85));
    return blob ? { blob, mime: outMime } : { blob: file, mime };
  } finally {
    bmp.close();
  }
}

/**
 * Store a dropped or pasted image as a new Attachment: bytes into the local
 * blob table first, then the record (whose push uploads them). Returns the
 * record — its `name` is what the body embeds.
 */
export async function addAttachment(file: Blob & { name?: string }): Promise<Attachment> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be attached");
  const { blob, mime } = await prepareImage(file);
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error(`Image is too big (${Math.round(blob.size / 1048576)} MB; the limit is 20 MB)`);
  if (!EXT_BY_MIME[mime]) throw new Error(`Unsupported image type: ${mime || "unknown"}`);
  const existing = await db().collection<Attachment>(ATTACHMENTS).toArray();
  const taken = new Set(existing.map((a) => normalizeName(a.name)));
  const name = attachmentName(file.name, extensionFor(mime), (n) => taken.has(normalizeName(n)));
  const id = newId();
  await blobs().put({ id, blob });
  const rec = { id, name, mime, size: blob.size };
  await put<Attachment>(ATTACHMENTS, rec);
  return { ...rec, updatedAt: new Date().toISOString(), deleted: 0 };
}

// --- bytes ---------------------------------------------------------------------

const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
let fileToken: { value: string; expires: number } | null = null;

/** A PocketBase file token, cached well inside its short life. */
async function token(): Promise<string> {
  if (fileToken && fileToken.expires > Date.now()) return fileToken.value;
  const value = await pb.files.getToken();
  fileToken = { value, expires: Date.now() + 90_000 };
  return value;
}

/**
 * An object URL for an Attachment's bytes: the local blob when we have it,
 * else fetched once from PocketBase with a file token and cached locally for
 * good (ADR 0037). Rejects while an Attachment made elsewhere has not been
 * uploaded yet, or offline without a cached copy.
 */
export function attachmentUrl(att: Attachment): Promise<string> {
  const hit = objectUrls.get(att.id);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(att.id);
  if (pending) return pending;
  const p = (async () => {
    let blob = (await blobs().get(att.id))?.blob;
    if (!blob) {
      if (!att.file) throw new Error("Not uploaded yet");
      const base = pb.baseURL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/files/${ATTACHMENTS}/${att.id}/${encodeURIComponent(att.file)}?token=${encodeURIComponent(await token())}`);
      if (!res.ok) throw new Error(`Could not load image (${res.status})`);
      blob = await res.blob();
      await blobs().put({ id: att.id, blob });
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(att.id, url);
    return url;
  })();
  inflight.set(att.id, p);
  p.finally(() => inflight.delete(att.id)).catch(() => {});
  return p;
}

/** Forget a cached blob (a deleted Attachment's). */
export async function dropAttachmentBlob(id: string): Promise<void> {
  await blobs().delete(id);
  const url = objectUrls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    objectUrls.delete(id);
  }
}

// --- operations ----------------------------------------------------------------

/** Rename an Attachment and rewrite `![[Old]]` → `![[New]]` in every body (as renaming a Note does). */
export async function renameAttachment(att: Attachment, newName: string): Promise<void> {
  let name = sanitizeAttachmentName(newName);
  if (!name) return;
  const oldExt = /\.([A-Za-z0-9]+)$/.exec(att.name)?.[1];
  if (oldExt && !/\.[A-Za-z0-9]+$/.test(name)) name = `${name}.${oldExt}`;
  if (name === att.name) return;
  const all = await allAttachments();
  if (all.some((a) => a.id !== att.id && normalizeName(a.name) === normalizeName(name))) throw new Error(`“${name}” is already taken`);
  await put<Attachment>(ATTACHMENTS, { ...att, name });
  for (const d of await allDocuments()) {
    if (typeof d.body !== "string" || !d.body) continue;
    const body = renameLinks(d.body, att.name, name);
    if (body !== d.body) await putDocument({ ...d, body } as Document);
  }
}

/** Every orphaned Attachment (no body embeds it). */
export async function orphanedAttachments(): Promise<Attachment[]> {
  // ADR 0038: a locked gate hides bodies; their embeds would look orphaned. Refuse rather than peek.
  if ((await privateGate()).locked) throw new Error("Unlock Private first");
  return orphanedAmong(await allAttachments(), await allDocuments());
}

/** Tombstone an Attachment and drop its local bytes; the push clears the server file too. */
export async function deleteAttachment(id: string): Promise<void> {
  await remove(ATTACHMENTS, id);
  await dropAttachmentBlob(id);
}

/** Drop cached bytes whose record is gone or tombstoned (another device's clean-up). Never touches one still queued for push. */
export async function pruneAttachmentBlobs(): Promise<void> {
  const live = new Set((await allAttachments()).map((a) => a.id));
  const queued = new Set((await db()._outbox.where("collection").equals(ATTACHMENTS).toArray()).map((e) => e.recordId));
  for (const r of await blobs().toArray()) if (!live.has(r.id) && !queued.has(r.id)) await dropAttachmentBlob(r.id);
}
