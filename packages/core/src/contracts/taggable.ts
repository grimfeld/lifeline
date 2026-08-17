import { appById, taggableProviders } from "../registry";

/**
 * The Taggable Contract (ADR 0014): an App reports its tagged entities so
 * Core can derive the tag vocabulary and any Surface can browse items by
 * Tag across Apps. Untagged entities are not reported.
 */
export interface TaggedItem {
  appId: string;
  itemId: string;
  title: string;
  subtitle?: string;
  /** Normalised tags (see normalizeTags). Never empty. */
  tags: string[];
  /** Route to open the entity, e.g. "/app/tasks". */
  href?: string;
}

export interface TaggableProvider {
  appId: string;
  /** React hook. Every live entity carrying at least one tag. */
  useTagged(): TaggedItem[];
}

export interface SurfaceTaggedItem extends TaggedItem {
  /** `${appId}/${itemId}` — unique across Apps. */
  key: string;
  color?: string;
}

/** Read side: every provider's tagged entities, coloured per App. */
export function useTaggedItems(): SurfaceTaggedItem[] {
  const providers = taggableProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const per = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    items: p.useTagged(),
  }));
  const out: SurfaceTaggedItem[] = [];
  for (const { provider, items } of per) {
    const color = appById(provider.appId)?.color;
    for (const it of items) out.push({ ...it, key: `${it.appId}/${it.itemId}`, color });
  }
  return out;
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
}
