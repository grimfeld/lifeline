import { Navigate, Route, Routes, useParams } from "react-router";
import { inhabitedModules, moduleById, moduleHome, moduleScreens, screenRoute } from "@lifeline/core";
import { ModuleLayout } from "./ModuleLayout";
import { FALLBACK_PLACE } from "../nav/resume";
import { MODULE_SHELLS } from "./shells";

/**
 * `/module/:id/*` — where a Module lands, and a hand-written Module's own
 * pages (ADR 0057).
 *
 * - A hand-written Module (`MODULE_SHELLS`) routes its own pages below here,
 *   its home at the bare path, inside its own layout.
 * - A Module with a layout mounted elsewhere lands at that layout's home
 *   (Note-taking at the Vault).
 * - A Module still on its stand-in lands on its first screen: the stand-in's
 *   list already shows the rest, and an index repeating it would be a menu of
 *   a menu.
 *
 * A Module the Workspace does not take still opens — a Module scopes the Rail,
 * never the ability to reach a place (the palette reaches everything).
 */
export function ModulePage() {
  const { id = "" } = useParams<{ id: string }>();
  const m = moduleById(id);
  // A Module no registered App inhabits does not open: Mail in the Demo (ADR 0077).
  // Not `/`, which would resume the path just remembered — this one.
  if (!m || !inhabitedModules().some((x) => x.id === m.id)) return <Navigate to={FALLBACK_PLACE} replace />;

  const shell = MODULE_SHELLS[id];
  if (shell) {
    return (
      <Routes>
        {shell.pages.map((p) => {
          const Page = p.component;
          return (
            <Route
              key={p.path || "home"}
              path={p.path || "/"}
              element={
                <ModuleLayout moduleId={id} bare={p.bare}>
                  <Page />
                </ModuleLayout>
              }
            />
          );
        })}
        <Route path="*" element={<Navigate to={`/module/${id}`} replace />} />
      </Routes>
    );
  }

  if (moduleHome(m) !== `/module/${m.id}`) return <Navigate to={moduleHome(m)} replace />;
  const first = moduleScreens(id)[0];
  if (first) return <Navigate to={screenRoute(first)} replace />;
  return (
    <ModuleLayout moduleId={id}>
      <p className="text-muted-foreground p-6 text-sm">Nothing in {m.title} yet.</p>
    </ModuleLayout>
  );
}
