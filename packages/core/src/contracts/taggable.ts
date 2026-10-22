import { useMemo } from "react";
import { appById } from "../registry";
import { useAllDocuments } from "../documents/store";
import { useDocumentTypes } from "../documents/registry";
import { displayTitle, singularOf, type Document, type DocumentTypeDef } from "../documents/types";
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

let tagged: { docs: Document[]; types: DocumentTypeDef[]; items: SurfaceTaggedItem[] } | null = null;

/**
 * Every tagged Document (internal types excluded), coloured per owning App.
 * Worked out once per (Documents, types) pair, however many callers ask:
 * some forty mounted components do, most of them dialogs, and each rebuilt it.
 */
export function taggedItemsFor(docs: Document[], types: DocumentTypeDef[]): SurfaceTaggedItem[] {
  if (tagged && tagged.docs === docs && tagged.types === types) return tagged.items;
  const defs = new Map(types.map((t) => [t.id, t]));
  const items: SurfaceTaggedItem[] = [];
  for (const d of docs) {
    if (!d.tags || d.tags.length === 0) continue;
    const def = defs.get(d.type);
    if (def?.internal) continue;
    const appId = def?.appId ?? VAULT_APP_ID;
    items.push({
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
  tagged = { docs, types, items };
  return items;
}

/** Every tagged Document (internal types excluded), coloured per owning App. A React hook; every caller shares one list per change. */
export function useTaggedItems(): SurfaceTaggedItem[] {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => taggedItemsFor(docs, types), [docs, types]);
}

export interface TagVocabularyEntry {
  tag: string;
  count: number;
  /** Count per App id. */
  byApp: Record<string, number>;
}

let vocabulary: { items: TaggedItem[]; entries: TagVocabularyEntry[] } | null = null;

/** Every tag in use among these items, most used first. Sorted once per list of items, however many callers ask. */
export function tagVocabularyOf(items: TaggedItem[]): TagVocabularyEntry[] {
  if (vocabulary && vocabulary.items === items) return vocabulary.entries;
  const map = new Map<string, TagVocabularyEntry>();
  for (const it of items) {
    for (const tag of it.tags) {
      let e = map.get(tag);
      if (!e) map.set(tag, (e = { tag, count: 0, byApp: {} }));
      e.count++;
      e.byApp[it.appId] = (e.byApp[it.appId] ?? 0) + 1;
    }
  }
  const entries = Array.from(map.values()).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  vocabulary = { items, entries };
  return entries;
}

/** Derived vocabulary: every tag in use, most used first. A React hook; every caller shares one list per change. */
export function useTagVocabulary(): TagVocabularyEntry[] {
  const items = useTaggedItems();
  return useMemo(() => tagVocabularyOf(items), [items]);
}
