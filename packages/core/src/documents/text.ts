import { serializeFrontmatter, splitFrontmatter, type Properties, type PropertyValue } from "../markdown";
import { isCommonKey, type Document, type DocumentTypeDef, type FieldDef } from "./types";

/**
 * The text projection of a Document (ADR 0018): `frontmatter + body`. Not
 * storage — a view for the Vault editor and vault import/export. Fields
 * become frontmatter; guarded fields are shown but edits to them are
 * rejected on the way back (ADR 0019).
 */
export interface TextCodec {
  /** Title of a Document by id, for Link fields written as `[[Title]]`. */
  linkName?: (id: string) => string | undefined;
  /** Resolve a `[[Name]]` (or bare name) to a Document id, for Link fields read back. */
  resolveLink?: (name: string) => string | undefined;
}

const LINK_WRAP = /^\[\[(.+)\]\]$/;

function fieldToProperty(f: FieldDef, v: unknown, codec: TextCodec): PropertyValue | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  switch (f.kind) {
    case "boolean":
      return v ? "true" : "false";
    case "number":
      return typeof v === "number" ? v : Number(v);
    case "geo":
      return Array.isArray(v) ? v.map(String) : String(v);
    case "list":
    case "multiselect":
      return Array.isArray(v) ? v.map(String) : [String(v)];
    case "link": {
      const ids = Array.isArray(v) ? v.map(String) : [String(v)];
      const names = ids.map((id) => `[[${codec.linkName?.(id) ?? id}]]`);
      return names.length === 1 ? names[0] : names;
    }
    case "json":
      return JSON.stringify(v);
    default:
      return Array.isArray(v) ? v.map(String) : typeof v === "number" ? v : String(v);
  }
}

function propertyToField(f: FieldDef, v: PropertyValue | undefined, codec: TextCodec): unknown {
  if (v === undefined || v === "") return f.kind === "list" || f.kind === "multiselect" ? [] : null;
  switch (f.kind) {
    case "boolean":
      return v === "true" || v === 1 || v === "1" || v === "yes";
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    }
    case "geo": {
      const parts = Array.isArray(v) ? v : String(v).split(",");
      if (parts.length !== 2) return null;
      const lat = Number(parts[0]);
      const lon = Number(parts[1]);
      return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
    }
    case "list":
    case "multiselect":
      return Array.isArray(v) ? v.map(String) : [String(v)];
    case "json": {
      try {
        return JSON.parse(Array.isArray(v) ? v.join(",") : String(v));
      } catch {
        return null;
      }
    }
    case "link": {
      const names = Array.isArray(v) ? v.map(String) : [String(v)];
      const ids = names.map((n) => {
        const m = LINK_WRAP.exec(n.trim());
        const name = m ? m[1] : n.trim();
        return codec.resolveLink?.(name) ?? name;
      });
      return ids.length === 1 ? ids[0] : ids;
    }
    default:
      return Array.isArray(v) ? v.join(", ") : String(v);
  }
}

/** Render a Document as frontmatter + body. Tags and the type's fields go into the frontmatter; unknown extra fields too. */
export function documentToText(doc: Document, def: DocumentTypeDef | undefined, codec: TextCodec = {}): string {
  const props: Properties = {};
  const known = new Set<string>();
  for (const f of def?.fields ?? []) {
    known.add(f.key);
    if (f.hidden) continue;
    const p = fieldToProperty(f, doc[f.key], codec);
    if (p !== undefined) props[f.key] = p;
  }
  if (doc.tags && doc.tags.length > 0) props.tags = [...doc.tags];
  for (const [k, v] of Object.entries(doc)) {
    if (isCommonKey(k) || known.has(k) || v === undefined || v === null || v === "") continue;
    if (typeof v === "string" || typeof v === "number") props[k] = v;
    else if (Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number")) props[k] = v.map(String);
  }
  return serializeFrontmatter(props) + (doc.body ?? "");
}

export interface TextParseResult {
  /** Patch to apply to the Document (fields + body + explicit tags). */
  patch: Record<string, unknown>;
  /** Guarded fields whose edit was rejected (ADR 0019). */
  rejected: string[];
}

/**
 * Read frontmatter + body back into a patch. Guarded fields are compared
 * against the current Document and reverted (reported in `rejected`).
 */
export function textToDocument(text: string, current: Document, def: DocumentTypeDef | undefined, codec: TextCodec = {}): TextParseResult {
  const { properties, content } = splitFrontmatter(text);
  const patch: Record<string, unknown> = {};
  const rejected: string[] = [];
  const known = new Set<string>();
  for (const f of def?.fields ?? []) {
    known.add(f.key);
    if (f.hidden) continue;
    const next = propertyToField(f, properties[f.key], codec);
    const cur = current[f.key] ?? null;
    const same = JSON.stringify(next) === JSON.stringify(cur ?? (f.kind === "list" || f.kind === "multiselect" ? [] : null));
    if (same) continue;
    if (f.guarded) {
      rejected.push(f.key);
      continue;
    }
    patch[f.key] = next;
  }
  const tagsRaw = properties.tags;
  patch.tags = Array.isArray(tagsRaw) ? tagsRaw.map(String) : typeof tagsRaw === "string" ? tagsRaw.split(/[,\s]+/).filter(Boolean) : [];
  for (const [k, v] of Object.entries(properties)) {
    if (k === "tags" || known.has(k) || isCommonKey(k)) continue;
    patch[k] = v;
  }
  if (def?.body !== "none") patch.body = content;
  return { patch, rejected };
}
