import { useNavigate } from "react-router";
import { Button } from "@lifeline/ui";
import { registeredApps, screenRoute, useSurfaceScope } from "@lifeline/core";

/**
 * The screens of the Apps that live on the time Surfaces (ADR 0057): an App
 * naming no Module has no destination of its own, so where its Documents are
 * shown is where they are managed from — the Calendar App's Events, templates
 * and blockers, one tap from the Calendar and the Schedule.
 */
export function TimeAppLinks() {
  const navigate = useNavigate();
  // Embedded in a Module, the Surface shows that Module's items only, and an
  // App that belongs to no Module has nothing to manage there.
  const scope = useSurfaceScope();
  const screens = scope ? [] : registeredApps()
    .filter((a) => a.timed && !a.module)
    .flatMap((a) => a.screens.filter((s) => !s.hidden));
  return (
    <>
      {screens.map((s) => {
        const Icon = s.icon;
        return (
          <Button key={s.id} variant="outline" className="h-8" title={`Manage ${s.title.toLowerCase()}`} onClick={() => navigate(screenRoute(s))}>
            {Icon && <Icon />} <span className="max-md:hidden">{s.title}</span>
          </Button>
        );
      })}
    </>
  );
}
