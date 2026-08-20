import { useMemo } from "react";
import { appById } from "../registry";
import { useAllDocuments } from "../documents/store";
import { useDocumentTypes } from "../documents/registry";
import { displayTitle, singularOf } from "../documents/types";
import { docHref } from "../documents/href";
import { VAULT_APP_ID } from "./locatable";

/**
 * Tags across Documents (ADR 0014, ADR 0018): every Document carries Tags by
 * construction, so there is no Taggable Contract any more — Core derives
 * the vocabulary and the tagged list straight from the store.
 */
export interface TaggedItem {
  appId: string;
  itemId: string;
  type: string;
  title: string;
  subtitle?: string;
  /** Never empty. */
  tags: string[];
  href?: string;
}

export interface SurfaceTaggedItem extends TaggedItem {
  key: string;
  color?: string;
}

/** Every tagged Document (internal types excluded), coloured per owning App. */
export function useTaggedItems(): SurfaceTaggedItem[] {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    const out: SurfaceTaggedItem[] = [];
    for (const d of docs) {
      if (!d.tags || d.tags.length === 0) continue;
      const def = defs.get(d.type);
      if (def?.internal) continue;
      const appId = def?.appId ?? VAULT_APP_ID;
      out.push({
        key: `${d.type}/${d.id}`,
        appId,
        itemId: d.id,
        type: d.type,
        title: displayTitle(d, def),
        subtitle: def && singularOf(def),
        tags: d.tags,
        href: docHref(d, def),
        color: def?.appId ? appById(def.appId)?.color : undefined,
      });
    }
    return out;
  }, [docs, types]);
}

export interface TagVocabularyEntry {
  tag: string;
  count: number;
  /** Count per App id. */
  byApp: Record<string, number>;
}

/** Derived vocabulary: every tag in use, most used first. A React hook. */
export function useTagVocabulary(): TagVocabularyEntry[] {
  const items = useTaggedItems();
  return useMemo(() => {
    const map = new Map<string, TagVocabularyEntry>();
    for (const it of items) {
      for (const tag of it.tags) {
        let e = map.get(tag);
        if (!e) map.set(tag, (e = { tag, count: 0, byApp: {} }));
        e.count++;
        e.byApp[it.appId] = (e.byApp[it.appId] ?? 0) + 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [items]);
}
