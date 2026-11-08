import type { LinkIndex } from "./links";

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
