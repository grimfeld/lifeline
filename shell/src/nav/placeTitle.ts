import { matchPath } from "react-router";
import { SURFACES, moduleById, moduleOfPath, screenRoute, screensOf } from "@lifeline/core";

/** Core's own destinations, by the root of their path (the Rail's names). */
const CORE_TITLES: [root: string, title: string][] = [
  ["/base", "Bases"],
  ["/screens", "Screens"],
  ["/screen", "Screens"],
  ["/settings/macros", "Macros"],
  ["/settings/keys", "Keys"],
  ["/settings", "Settings"],
  ["/guide", "Guide"],
];

/**
 * The name of the place a path stands in, for the browser tab when the page
 * has no `PageHeader` of its own (WCAG 2.4.2): the App screen's title, else its
 * Module's, else the Surface's or Core destination's. Undefined for a path
 * nothing claims (it redirects).
 */
export function placeTitle(pathname: string): string | undefined {
  const under = (root: string) => pathname === root || pathname.startsWith(root + "/");
  // The most specific App screen that matches: "/app/ledger/budget" over "/app/ledger".
  let best: { title: string; length: number } | undefined;
  for (const s of screensOf()) {
    const route = screenRoute(s);
    if (matchPath({ path: route, end: true }, pathname) && route.length > (best?.length ?? -1)) {
      best = { title: s.title, length: route.length };
    }
  }
  if (best) return best.title;
  const moduleId = moduleOfPath(pathname);
  if (moduleId) return moduleById(moduleId)?.title;
  const surface = SURFACES.find((s) => under(s.path));
  if (surface) return surface.title;
  return CORE_TITLES.find(([root]) => under(root))?.[1];
}
