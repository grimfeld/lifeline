import { SURFACES, moduleOfPath } from "@lifeline/core";
import { guidePageOfModule, guidePageOfSurface } from "@lifeline/guide";

/** Core destinations whose Guide page is their own, by route. */
export const CORE_PAGES: [root: string, slug: string][] = [
  ["/base", "bases"],
  ["/screens", "screens"],
  ["/screen", "screens"],
  ["/settings", "settings"],
  ["/vault", "vault"],
  ["/handoff", "peek"],
];

/**
 * The Guide page for where the user stands (ADR 0089): the open Module's, the
 * Surface's, a Core page's own — or the Guide's home, for anywhere else,
 * the Guide itself included.
 */
export function guideSlugForPath(pathname: string): string {
  const under = (root: string) => pathname === root || pathname.startsWith(root + "/");
  const surface = SURFACES.find((s) => under(s.path));
  if (surface) return guidePageOfSurface(surface.id)?.slug ?? "index";
  const core = CORE_PAGES.find(([root]) => under(root));
  if (core) return core[1];
  return guidePageOfModule(moduleOfPath(pathname))?.slug ?? "index";
}

export function guideHref(slug: string): string {
  return slug === "index" ? "/guide" : `/guide/${slug}`;
}
