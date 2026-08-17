import { appById, backlinkProviders, linkableProviders } from "../registry";

/**
 * The Linkable Contract (ADR 0009): an App exposes its entities as wikilink
 * targets by name. Resolution is by name/alias, never by id, so a link keeps
 * working across renames of the *note* and stays Obsidian-compatible.
 */
export interface LinkTarget {
  appId: string;
  itemId: string;
  name: string;
  aliases?: string[];
  subtitle?: string;
  /** Route to open the entity, e.g. "/app/stats/abc". */
  href?: string;
  /** The entity's Tags (ADR 0014). */
  tags?: string[];
}

export interface LinkableProvider {
  appId: string;
  /** React hook. Every live entity that can be a link target. */
  useTargets(): LinkTarget[];
}

export interface SurfaceLinkTarget extends LinkTarget {
  color?: string;
}

/** Read side: every provider's targets, coloured per App. */
export function useLinkTargets(): SurfaceLinkTarget[] {
  const providers = linkableProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const per = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    targets: p.useTargets(),
  }));
  const out: SurfaceLinkTarget[] = [];
  for (const { provider, targets } of per) {
    const color = appById(provider.appId)?.color;
    for (const t of targets) out.push({ ...t, color });
  }
  return out;
}

/** A place that mentions a Linkable entity or a note — reported by whoever owns links (the Notes App). */
export interface Backlink {
  /** Owning App of the referring document (e.g. "notes"). */
  appId: string;
  /** Id of the referring document. */
  sourceId: string;
  title: string;
  /** Short context around the mention. */
  excerpt?: string;
  href?: string;
}

export interface BacklinkProvider {
  appId: string;
  /** React hook. Documents mentioning the given App entity. */
  useBacklinks(target: { appId: string; itemId: string }): Backlink[];
}

/** Read side for Apps: "mentioned in" for one of their entities. */
export function useBacklinks(target: { appId: string; itemId: string }): Backlink[] {
  const providers = backlinkProviders();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return providers.flatMap((p) => p.useBacklinks(target));
}
