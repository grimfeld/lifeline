import { DESK_SURFACES, moduleById, moduleHome } from "@lifeline/core";
import { LayoutDashboard } from "lucide-react";
import { MODULE_ICONS, SURFACE_ICONS } from "../navIcons";

/** One place the Hub offers: a Module, or a general Surface. */
export interface HubPlace {
  key: string;
  title: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * What the Hub lists, on the desk's index and the phone's grid alike (ADR 0133,
 * #664): the Workspace's Modules in its order, then the general Surfaces.
 */
export function hubPlaces(modules: readonly string[]): { modules: HubPlace[]; surfaces: HubPlace[] } {
  return {
    modules: modules.flatMap((id) => {
      const m = moduleById(id);
      return m ? [{ key: m.id, title: m.title, to: moduleHome(m), icon: MODULE_ICONS[m.id] ?? LayoutDashboard }] : [];
    }),
    surfaces: DESK_SURFACES.map((s) => ({ key: s.id, title: s.title, to: s.path, icon: SURFACE_ICONS[s.id] ?? LayoutDashboard })),
  };
}

/** The places whose name holds `query`, ignoring case and the spaces around it; all of them for an empty query. */
export function findPlaces<T extends { title: string }>(places: readonly T[], query: string): T[] {
  const q = query.trim().toLocaleLowerCase();
  return q ? places.filter((p) => p.title.toLocaleLowerCase().includes(q)) : [...places];
}
