import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Button, EmptyState, Input, PhoneDock } from "@lifeline/ui";
import { pathOnly, useCurrentWorkspaceId, useWorkspaceModules } from "@lifeline/core";
import { CircleHelp, Search, Settings, Table2 } from "lucide-react";
import { guideHref, guideSlugForPath } from "../guide/guidePlace";
import { lastPlace } from "../nav/resume";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { SyncBadge } from "../components/SyncBadge";
import { findPlaces, hubPlaces, type HubPlace } from "../hub/places";

/**
 * The phone's **Hub** (ADR 0133, #664), opened from the Phone bar's Hub slot:
 * a tile for each of the Workspace's Modules in its order, then the general
 * Surfaces (the desk's index, `hubPlaces`); Bases, Settings and the Guide; the
 * Workspace switcher; and a "Find…" field above the bar that narrows the
 * tiles. It holds what the ☰ drawer held: going between places is the Hub's,
 * a Module's own navigation is in its Phone dock.
 */
export function PhoneHub() {
  const modules = useWorkspaceModules();
  const workspaceId = useCurrentWorkspaceId();
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  // Opening the grid moves focus into it (not into Find: that would raise the keyboard).
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);

  const { modules: moduleTiles, surfaces } = hubPlaces(modules);
  const tiles = [...moduleTiles, ...surfaces];
  const shown = findPlaces(tiles, query);
  // The Hub is never a place `/` resumes to, so the last place is where the person came from:
  // the Guide opens on its page (ADR 0089), as the header's "?" did.
  const core: HubPlace[] = [
    { key: "bases", title: "Bases", to: "/base", icon: Table2 },
    { key: "settings", title: "Settings", to: "/settings", icon: Settings },
    { key: "guide", title: "Guide", to: guideHref(guideSlugForPath(pathOnly(lastPlace(workspaceId)))), icon: CircleHelp },
  ];
  const searching = query.trim() !== "";

  return (
    <div ref={ref} tabIndex={-1} aria-label="Hub" role="region" className="flex flex-col gap-4 p-4 outline-none">
      {/* Said as the tiles narrow, from a region that is always there. */}
      <p role="status" className="sr-only">
        {searching ? (shown.length === 1 ? "1 place" : `${shown.length} places`) : ""}
      </p>
      {shown.length > 0 ? (
        <ul aria-label="Places" className="grid grid-cols-2 gap-2">
          {shown.map((t) => (
            <li key={t.key} className="min-w-0">
              <Link to={t.to} className="bg-card hover:bg-accent flex min-h-20 flex-col justify-between gap-2 rounded-lg border p-3">
                <t.icon className="text-muted-foreground size-5 shrink-0" />
                <span className="line-clamp-2 text-sm font-medium">{t.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          data-hub-no-match=""
          action={
            <Button variant="outline" size="sm" onClick={() => setQuery("")}>
              Clear the search
            </Button>
          }
        >
          Nothing here is called “{query.trim()}”. Bases, Settings and the Guide are below; the palette finds Documents.
        </EmptyState>
      )}
      <ul aria-label="Core" className="grid grid-cols-3 gap-2">
        {core.map((t) => (
          <li key={t.key} className="min-w-0">
            <Link to={t.to} className="bg-card hover:bg-accent flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-sm">
              <t.icon className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{t.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex min-w-0 flex-col gap-1">
        <WorkspacePicker />
        {/* Gone where it renders nothing (the Demo, ADR 0077). */}
        <div className="empty:hidden">
          <SyncBadge />
        </div>
      </div>
      {/* Find sits right above the Phone bar, in the dock. */}
      <PhoneDock>
        <div className="relative px-2 py-1.5">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
          <Input type="search" aria-label="Find a place" placeholder="Find…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </PhoneDock>
    </div>
  );
}
