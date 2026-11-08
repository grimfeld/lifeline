import { excerpt } from "../markdown";
import type { Backlink, LinkIndex } from "./links";
import { fieldsOfDocument } from "./roles";
import type { Document, DocumentTypeDef } from "./types";

/** The Documents of one type that link to a target through a Link field, and the field each one did it by. */
export interface FieldLinkGroup {
  /** The linking Documents' type id. */
  type: string;
  rows: { sourceId: string; field: string }[];
}

/**
 * What links to `docId` through a Link field (an Event's With, a Task's For…),
 * grouped by the type of the Document that links, in the order the types
 * first appear. A wikilink in a body is not here: that is a plain Backlink.
 * Generic over fields, so every People field shows up with no extra work.
 */
export function fieldLinksTo(index: LinkIndex, docId: string): FieldLinkGroup[] {
  const groups = new Map<string, FieldLinkGroup>();
  for (const b of index.backlinksTo(docId)) {
    if (!b.field) continue;
    const type = index.byId.get(b.sourceId)?.type;
    if (!type) continue;
    const group = groups.get(type) ?? { type, rows: [] };
    group.rows.push({ sourceId: b.sourceId, field: b.field });
    groups.set(type, group);
  }
  return [...groups.values()];
}

/** The Backlinks a page lists as such: every one, or with `wikilinksOnly` none made through a Link field (those are `fieldLinksTo`'s). */
export function backlinksShown(index: LinkIndex, docId: string, wikilinksOnly: boolean): Backlink[] {
  const all = index.backlinksTo(docId);
  return wikilinksOnly ? all.filter((b) => !b.field) : all;
}

/** What a Backlink's row says under its title: the Link field it came through, the words around the wikilink, or else the start of the linking body. */
export function backlinkContext(b: Backlink, src: Document | undefined): string {
  if (b.field) return `via ${b.field}`;
  return b.context || excerpt(typeof src?.body === "string" ? src.body : "", 100);
}

/** A Link field's label on the Document that holds it ("With"), or its key when the Document has no such field. */
export function linkFieldLabel(d: Document | undefined, def: DocumentTypeDef | undefined, key: string): string {
  const f = d && fieldsOfDocument(d, def).find((x) => x.key === key);
  return f ? f.label : key;
}
