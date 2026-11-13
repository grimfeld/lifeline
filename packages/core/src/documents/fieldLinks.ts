import { excerpt } from "../markdown";
import type { Backlink } from "./links";
import { fieldsOfDocument } from "./roles";
import type { Document, DocumentTypeDef } from "./types";

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
