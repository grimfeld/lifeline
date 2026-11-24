import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button, Input, PhoneDock } from "@lifeline/ui";
import { DESK_SURFACES, moduleById, moduleHome, useWorkspaceModules } from "@lifeline/core";
import { CircleHelp, LayoutDashboard, Search, Settings, Table2 } from "lucide-react";
import { MODULE_ICONS, SURFACE_ICONS } from "../navIcons";
import { guideHref, guideSlugForPath } from "../guide/guidePlace";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { SyncBadge } from "../components/SyncBadge";

type Icon = React.ComponentType<{ className?: string }>;

interface Tile {
  key: string;
  title: string;
  to: string;
  icon: Icon;
}

/**
 * The phone's **Hub** (ADR 0133, #664), opened from the Phone bar's Hub slot:
 * a tile for each of the Workspace's Modules in its order, then the general
 * Surfaces; Bases, Settings and the Guide; the Workspace switcher; and a
 * "Find…" field above the bar that narrows the tiles. It holds what the ☰
 * drawer held: going between places is the Hub's, a Module's own navigation is
 * in its Phone dock.
 */
export function PhoneHub() {
  const modules = useWorkspaceModules();
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  // Opening the grid moves focus into it (not into Find: that would raise the keyboard).
  useEffect(() => ref.current?.focus({ preventScroll: true }), []);

  const tiles: Tile[] = [
    ...modules.flatMap((id) => {
      const m = moduleById(id);
      return m ? [{ key: m.id, title: m.title, to: moduleHome(m), icon: MODULE_ICONS[m.id] ?? LayoutDashboard }] : [];
    }),
    ...DESK_SURFACES.map((s) => ({ key: s.id, title: s.title, to: s.path, icon: SURFACE_ICONS[s.id] ?? LayoutDashboard })),
  ];
  const q = query.trim().toLocaleLowerCase();
  const shown = q ? tiles.filter((t) => t.title.toLocaleLowerCase().includes(q)) : tiles;
  const core: Tile[] = [
    { key: "bases", title: "Bases", to: "/base", icon: Table2 },
    { key: "settings", title: "Settings", to: "/settings", icon: Settings },
    { key: "guide", title: "Guide", to: guideHref(guideSlugForPath(pathname)), icon: CircleHelp },
  ];

  return (
    <div ref={ref} tabIndex={-1} aria-label="Hub" role="region" className="flex flex-col gap-4 p-4 outline-none">
      <h1 className="sr-only">Hub</h1>
      {shown.length > 0 ? (
        <ul aria-label="Places" className="grid grid-cols-2 gap-2">
          {shown.map((t) => (
            <li key={t.key} className="min-w-0">
              <TileLink tile={t} />
            </li>
          ))}
        </ul>
      ) : (
        <div role="status" className="text-muted-foreground flex flex-col items-start gap-2 text-sm">
          <p>Nothing here is called “{query.trim()}”. Bases, Settings and the Guide are below; the palette finds Documents.</p>
          <Button variant="outline" size="sm" onClick={() => setQuery("")}>
            Clear the search
          </Button>
        </div>
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
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <WorkspacePicker />
        </div>
        {/* Gone where it renders nothing (the Demo, ADR 0077). */}
        <div className="shrink-0 empty:hidden">
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

function TileLink({ tile }: { tile: Tile }) {
  const Icon = tile.icon;
  return (
    <Link to={tile.to} className="bg-card hover:bg-accent flex min-h-20 flex-col justify-between gap-2 rounded-lg border p-3">
      <Icon className="text-muted-foreground size-5 shrink-0" />
      <span className="line-clamp-2 text-sm font-medium">{tile.title}</span>
    </Link>
  );
}
