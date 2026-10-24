import { NavLink, useLocation } from "react-router";
import { cn, Tip } from "@lifeline/ui";
import { SURFACES, moduleById, moduleHome, moduleOfPath, useWorkspaceModules } from "@lifeline/core";
import { CircleHelp, LayoutDashboard, Settings, Table2 } from "lucide-react";
import { MODULE_ICONS, SURFACE_ICONS } from "../navIcons";
import { guideHref, guideSlugForPath } from "../guide/guidePlace";
import { SyncBadge } from "./SyncBadge";
import { WorkspacePicker } from "./WorkspacePicker";

type Icon = React.ComponentType<{ className?: string }>;

interface RailItem {
  key: string;
  title: string;
  to: string;
  icon: Icon;
  active: boolean;
}

/**
 * The **Rail** (ADR 0057): Core's only chrome. The Workspace on top, then the
 * Workspace's Modules, then the general Surfaces, then the Bases and Screens,
 * with the Guide, Settings and sync at the foot. The Guide opens on the page
 * for where the user stands (ADR 0089). It is how you go *between* places and
 * never shows what is *inside* one — that is the open Module's.
 *
 * `expanded` is the phone drawer's form of the same list, with labels.
 */
export function Rail({ expanded = false, className }: { expanded?: boolean; className?: string }) {
  const { pathname } = useLocation();
  const modules = useWorkspaceModules();
  const current = moduleOfPath(pathname);
  const under = (root: string) => pathname === root || pathname.startsWith(root + "/");

  const moduleItems: RailItem[] = modules.flatMap((id) => {
    const m = moduleById(id);
    if (!m) return [];
    return [{ key: m.id, title: m.title, to: moduleHome(m), icon: MODULE_ICONS[m.id] ?? LayoutDashboard, active: current === m.id }];
  });
  const surfaceItems: RailItem[] = SURFACES.map((s) => ({
    key: s.id,
    title: s.title,
    to: s.path,
    icon: SURFACE_ICONS[s.id] ?? LayoutDashboard,
    active: under(s.path),
  }));
  const coreItems: RailItem[] = [
    { key: "bases", title: "Bases", to: "/base", icon: Table2, active: under("/base") },
    { key: "screens", title: "Screens", to: "/screens", icon: LayoutDashboard, active: under("/screens") || under("/screen") },
  ];

  const row = (item: RailItem) => <RailLink key={item.key} item={item} expanded={expanded} />;

  return (
    <nav
      aria-label="Rail"
      className={cn(
        "bg-sidebar text-sidebar-foreground flex shrink-0 flex-col gap-1 py-2",
        expanded ? "w-full px-2" : "w-14 items-center border-r",
        className,
      )}
    >
      <div className={cn(expanded ? "pb-1" : "pb-1")}>
        <WorkspacePicker compact={!expanded} />
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto", !expanded && "items-center")}>
        {moduleItems.map(row)}
        <Divider expanded={expanded} />
        {surfaceItems.map(row)}
        <Divider expanded={expanded} />
        {coreItems.map(row)}
      </div>
      <div className={cn("flex flex-col gap-1", !expanded && "items-center")}>
        {row({ key: "guide", title: "Guide", to: guideHref(guideSlugForPath(pathname)), icon: CircleHelp, active: under("/guide") })}
        {row({ key: "settings", title: "Settings", to: "/settings", icon: Settings, active: under("/settings") })}
        {!expanded && <SyncBadge compact />}
      </div>
    </nav>
  );
}

function Divider({ expanded }: { expanded: boolean }) {
  return <div className={cn("bg-border my-1 h-px shrink-0", expanded ? "mx-2" : "w-6")} />;
}

function RailLink({ item, expanded }: { item: RailItem; expanded: boolean }) {
  const Icon = item.icon;
  const link = (
    <NavLink
      to={item.to}
      aria-current={item.active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center rounded-md transition-colors",
        expanded ? "gap-3 px-2 py-2 text-sm" : "size-9 justify-center",
        item.active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className={expanded ? "size-4" : "size-[18px]"} />
      {expanded && <span className="truncate">{item.title}</span>}
    </NavLink>
  );
  return expanded ? link : (
    <Tip label={item.title} side="right">
      {link}
    </Tip>
  );
}
