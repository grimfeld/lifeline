import type { Document, LinkIndex } from "@lifeline/core";

/** Types that are my own material for an argument (ADR 0068): what I took from Sources, what I thought, and the Sources themselves. */
export interface MaterialItem {
  id: string;
  /** Why it is material: pinned by hand, or linked from the Essay's text. */
  via: "pinned" | "linked";
}

/**
 * An Essay's **material**: what its body links to plus what I pinned, each
 * once, pinned first. Never another Essay's Versions or anything internal —
 * the index already leaves those out.
 */
export function materialOf(essay: Pick<Document, "id"> & { material?: unknown }, index: Pick<LinkIndex, "linksFrom" | "byId">): MaterialItem[] {
  const pinned = Array.isArray(essay.material) ? (essay.material as unknown[]).filter((x): x is string => typeof x === "string" && index.byId.has(x)) : [];
  const out: MaterialItem[] = pinned.map((id) => ({ id, via: "pinned" }));
  const seen = new Set(pinned);
  for (const l of index.linksFrom(essay.id)) {
    const ref = l.ref;
    if (ref.kind !== "doc" || ref.id === essay.id || seen.has(ref.id)) continue;
    seen.add(ref.id);
    out.push({ id: ref.id, via: "linked" });
  }
  return out;
}

/**
 * **Candidates** (ADR 0068): Documents one link away from the material —
 * what the material links to and what links to it — that are not material
 * yet, ranked by how many pieces of material they touch. Offered, never
 * added on their own.
 */
export function candidatesOf(essayId: string, material: readonly MaterialItem[], index: Pick<LinkIndex, "linksFrom" | "backlinksTo" | "byId">, accept: (doc: Document) => boolean = () => true): { id: string; touches: number }[] {
  const have = new Set([essayId, ...material.map((m) => m.id)]);
  const score = new Map<string, number>();
  const bump = (id: string) => {
    if (have.has(id)) return;
    const d = index.byId.get(id);
    if (!d || !accept(d)) return;
    score.set(id, (score.get(id) ?? 0) + 1);
  };
  for (const m of material) {
    const near = new Set<string>();
    for (const l of index.linksFrom(m.id)) if (l.ref.kind === "doc") near.add(l.ref.id);
    for (const b of index.backlinksTo(m.id)) near.add(b.sourceId);
    near.forEach(bump);
  }
  return [...score].map(([id, touches]) => ({ id, touches })).sort((a, b) => b.touches - a.touches || a.id.localeCompare(b.id));
}
