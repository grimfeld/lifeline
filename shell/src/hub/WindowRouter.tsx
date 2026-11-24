import { useMemo, type ReactNode } from "react";
import { createPath, parsePath, Router, UNSAFE_LocationContext, type Navigator, type To } from "react-router";

const pathOf = (to: To) => (typeof to === "string" ? to : createPath(to));

/**
 * A Window's own router (ADR 0133): what is inside sees the Window's route,
 * not the browser's, so each Window keeps its own place in its Module.
 *
 * Controlled: the route comes from the window layout, and every navigation is
 * handed to `onNavigate`, which takes it through the browser (the URL shows
 * the front Window's route, and a link to another Module opens that one's
 * Window). The browser's router is cut off above it, so this one may nest.
 */
export function WindowRouter({ route, onNavigate, children }: { route: string; onNavigate: (path: string, replace: boolean) => void; children: ReactNode }) {
  const location = useMemo(() => ({ ...parsePath(route), state: null, key: route }), [route]);
  const navigator = useMemo<Navigator>(
    () => ({
      createHref: pathOf,
      go: (delta) => window.history.go(delta),
      push: (to) => onNavigate(pathOf(to), false),
      replace: (to) => onNavigate(pathOf(to), true),
    }),
    [onNavigate],
  );
  return (
    // `null` is the "no router above" value react-router checks before it lets a Router mount.
    <UNSAFE_LocationContext.Provider value={null as never}>
      <Router location={location} navigator={navigator}>
        {children}
      </Router>
    </UNSAFE_LocationContext.Provider>
  );
}
