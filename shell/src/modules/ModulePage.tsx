import { Navigate, useParams } from "react-router";
import { moduleById, moduleHome, moduleScreens, screenRoute } from "@lifeline/core";
import { ModuleLayout } from "./ModuleLayout";

/**
 * `/module/:id` — where a Module lands (ADR 0057). A Module with a layout of
 * its own lands at that layout's home (Note-taking at the Vault). Every other
 * Module is on its stand-in until it is written by hand, and the stand-in's
 * home is simply its first screen: the stand-in's list already shows the rest,
 * and an index page repeating it would be a menu of a menu.
 *
 * A Module the Workspace does not take still opens — a Module scopes the Rail,
 * never the ability to reach a place (the palette reaches everything).
 */
export function ModulePage() {
  const { id = "" } = useParams<{ id: string }>();
  const m = moduleById(id);
  if (!m) return <Navigate to="/" replace />;
  if (moduleHome(m) !== `/module/${m.id}`) return <Navigate to={moduleHome(m)} replace />;
  const first = moduleScreens(id)[0];
  if (first) return <Navigate to={screenRoute(first)} replace />;
  return (
    <ModuleLayout moduleId={id}>
      <p className="text-muted-foreground p-6 text-sm">Nothing in {m.title} yet.</p>
    </ModuleLayout>
  );
}
