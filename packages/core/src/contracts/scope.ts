import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { appsOfModule } from "../registry";

/**
 * The **scope** of a Surface (ADR 0057): which Apps' items it shows. A general
 * Surface has none and shows everything its Contract reaches — the truth about
 * Tuesday. A Surface embedded in a Module is wrapped in that Module's scope and
 * shows only its own Apps' items — openly a lens. The Contract read-side hooks
 * (`useSurfaceItems`, `usePoolItems`, `useTimedItems`) consult it, as they do
 * the ambient Tag filter.
 */
export interface SurfaceScopeValue {
  moduleId: string;
  apps: ReadonlySet<string>;
}

const SurfaceScopeContext = createContext<SurfaceScopeValue | null>(null);

/** The scope in effect, or null on a general Surface. */
export function useSurfaceScope(): SurfaceScopeValue | null {
  return useContext(SurfaceScopeContext);
}

/** Whether an App's items belong on a Surface of this scope. */
export function inSurfaceScope(scope: SurfaceScopeValue | null, appId: string): boolean {
  return !scope || scope.apps.has(appId);
}

/** Embeds whatever it wraps in one Module: its Surfaces show that Module's Apps' items and no others. */
export function ModuleSurfaceScope({ moduleId, children }: { moduleId: string; children?: ReactNode }) {
  const value = useMemo<SurfaceScopeValue>(() => ({ moduleId, apps: new Set(appsOfModule(moduleId).map((a) => a.id)) }), [moduleId]);
  return createElement(SurfaceScopeContext.Provider, { value }, children);
}
