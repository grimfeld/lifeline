import { useMemo } from "react";
import { useLocation, useParams, useSearchParams } from "react-router";
import { isVaultType, todayStr, useAllDocuments, useDocumentTypes, type Document, type DocumentTypeDef } from "@lifeline/core";

/**
 * What the Vault tree shows (CONTEXT.md "Vault"): every Document of a
 * body-first type, plus any other non-internal Document that has a body.
 */
export function isVaultDoc(d: Document, def: DocumentTypeDef | undefined): boolean {
  if (!def) return typeof d.body === "string" && d.body.trim() !== "";
  if (def.internal) return false;
  if (isVaultType(def)) return true;
  return def.body !== "none" && typeof d.body === "string" && d.body.trim() !== "";
}

export function useVaultDocs(): Document[] {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    return docs.filter((d) => isVaultDoc(d, defs.get(d.type)));
  }, [docs, types]);
}

/** The Document currently open in the Vault, derived from the URL (/vault/d/:id or /vault/journal?d=). */
export function useOpenDoc(docs: Document[]): Document | undefined {
  const { pathname } = useLocation();
  const params = useParams();
  const [search] = useSearchParams();
  if (pathname.startsWith("/vault/journal")) {
    const d = search.get("d") ?? todayStr();
    return docs.find((n) => n.type === "daily" && n.title === d);
  }
  const id = params.id ?? pathname.match(/^\/vault\/(?:d|n)\/([^/]+)/)?.[1];
  return id ? docs.find((n) => n.id === id) : undefined;
}

/** Types the Vault can create from its New menu: non-internal, body-first, name-titled (date-titled ones open the Journal). */
export function useCreatableTypes(): DocumentTypeDef[] {
  const types = useDocumentTypes();
  return types.filter((t) => !t.internal && t.body !== "none" && (t.titleRule === "name" || t.titleRule === "date") && t.id !== "template");
}
