import { documentTypeSync } from "./registry";
import type { Document, DocumentTypeDef } from "./types";

/** The Vault's generic page for any Document. */
export function vaultDocPath(id: string): string {
  return `/vault/d/${id}`;
}

/** Route that opens a Document: the type's own page when it has one, else the Vault's generic page. */
export function docHref(doc: Document, def: DocumentTypeDef | undefined = documentTypeSync(doc.type)): string {
  return def?.href?.(doc) ?? vaultDocPath(doc.id);
}

/** Route of a type's Base. */
export function basePath(type: string): string {
  return `/base/${type}`;
}

/** Route of a type's Templates: they all live on the Journal's Templates page (ADR 0068), one section per type. */
export function templatesPath(type: string): string {
  return `/app/journal/templates#templates-${type}`;
}
