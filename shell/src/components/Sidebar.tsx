import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  Button,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from "@lifeline/ui";
import {
  MODULES,
  basePath,
  moduleOfApp,
  navSectionsOf,
  newId,
  put,
  screenRoute,
  useCurrentWorkspace,
  useDocumentTypes,
  useWorkspaceModules,
  useWorkspaceScreens,
  type NavSection,
  type UserScreen,
} from "@lifeline/core";
import { CalendarDays, ChevronRight, Clock, Columns3, EyeOff, LayoutDashboard, MapPin, Plus, Settings2, Smartphone, Sparkles, Table2, Waypoints } from "lucide-react";
import { SyncBadge } from "./SyncBadge";
import { setPhoneHome } from "../mobile/phoneHome";
import { FrameSwitcher } from "./FrameSwitcher";
import { WorkspacePicker } from "./WorkspacePicker";
import { useCollapsedSections, useHiddenBases, useOpenGroups } from "./sidebarPrefs";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
  );
}

/** A collapsible sidebar section; collapse state is per-device (sidebarPrefs). */
function Section({ id, title, actions, children }: { id: string; title: string; actions?: ReactNode; children: ReactNode }) {
  const [collapsed, toggle] = useCollapsedSections();
  const open = !collapsed.includes(id);
  return (
    <div>
      <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-xs font-medium">
        <button className="hover:text-foreground group flex flex-1 items-center gap-1 text-left" onClick={() => toggle(id)} aria-expanded={open}>
          <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          {title}
        </button>
        {actions}
      </div>
      {open && children}
    </div>
  );
}

/** One Nav group inside a section: a chevron row over its screens. Closed until opened (sidebarPrefs). */
function NavGroup({ title, open, active, onToggle, children }: { title: string; open: boolean; active: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button
        className={cn(
          "hover:bg-accent/50 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          active && !open && "font-medium",
        )}
        onClick={onToggle}
        aria-expanded={open}
      >
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
        {title}
      </button>
      {open && <div className="border-border ml-3.5 border-l pl-1">{children}</div>}
    </div>
  );
}

/** Nav group holding the current pathname — longest matching route wins ("/app/ledger/budget" over "/app/ledger"). */
function useActiveGroup(sections: NavSection[]): string | undefined {
  const { pathname } = useLocation();
  let best = -1;
  let group: string | undefined;
  for (const section of sections)
    for (const screen of section.screens) {
      const route = screenRoute(screen);
      if ((pathname === route || pathname.startsWith(route + "/")) && route.length > best) {
        best = route.length;
        group = section.group?.id;
      }
    }
  return group;
}

export function Sidebar({ className }: { className?: string } = {}) {
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

  // Modules scope chrome, and this is the chrome they scope (ADR 0047): the
  // Apps section and the Bases below it list this Workspace's Modules only.
  const modules = useWorkspaceModules();
  const sections = navSectionsOf(undefined, modules.length ? modules : undefined);
  const activeGroup = useActiveGroup(sections);
  const { open: openGroups, toggle: toggleGroup, reveal: revealGroup } = useOpenGroups();
  // Landing inside a closed group opens it, so the sidebar always shows where you are.
  useEffect(() => {
    if (activeGroup) revealGroup(activeGroup);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revealGroup is idempotent and re-created every render
  }, [activeGroup]);

  const types = useDocumentTypes().filter((t) => !t.internal);
  const [hiddenBases, toggleHiddenBase] = useHiddenBases();

  /**
   * Bases, shelved by the Module that owns them — which closes ADR 0041's
   * deferral ("its natural grouping is the owning App, which is a different
   * rule from these shelves"). It is no longer a different rule: a Module
   * holds Apps, an App owns types, a type has one Base. User-defined types
   * have no owning App and so no Module; they stay loose at the top, as an
   * App naming no Module does in the Apps section above.
   */
  const baseShelves = (() => {
    const visible = types.filter((t) => !hiddenBases.includes(t.id));
    const moduleIdOf = (t: (typeof visible)[number]) => (t.appId ? moduleOfApp(t.appId)?.id : undefined);
    const wanted = modules.length ? modules : MODULES.map((m) => m.id);
    // No Module means loose, not hidden: a user-defined type has no owning App
    // (ADR 0019) and so belongs to no Workspace's exclusion either.
    const loose = visible.filter((t) => !moduleIdOf(t));
    const shelves = MODULES.filter((m) => wanted.includes(m.id))
      .map((m) => ({ module: m.title, types: visible.filter((t) => moduleIdOf(t) === m.id) }))
      .filter((sh) => sh.types.length > 0);
    return loose.length > 0 ? [{ module: undefined as string | undefined, types: loose }, ...shelves] : shelves;
  })();
  const screens = useWorkspaceScreens();
  const ws = useCurrentWorkspace();

  async function createScreen() {
    if (!name.trim()) return;
    const id = newId();
    await put<UserScreen>("screens", {
      id,
      name: name.trim(),
      layout: [],
      sort: screens.length,
      // A Screen belongs to the Workspace it was made in (ADR 0047).
      workspace: ws?.id,
    });
    setName("");
    setNewOpen(false);
    navigate(`/screen/${id}`);
  }

  return (
    <aside className={cn("bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r", className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <Sparkles className="text-primary size-5" />
        <span className="text-base font-semibold tracking-tight">Lifeline</span>
      </div>
      <div className="px-2">
        <WorkspacePicker />
      </div>
      <FrameSwitcher />
      <Separator className="mt-2" />

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        <Section
          id="screens"
          title="Screens"
          actions={
            <Button size="icon" variant="ghost" className="size-5" title="New screen" onClick={() => setNewOpen(true)}>
              <Plus className="size-3.5" />
            </Button>
          }
        >
          {screens.map((s) => (
            <ContextMenu key={s.id}>
              <ContextMenuTrigger asChild>
                {/* Plain div absorbs Radix's asChild prop-merge — it stringifies NavLink's function className (same trick as the Bases rows). */}
                <div>
                  <NavLink to={`/screen/${s.id}`} className={navClass}>
                    <LayoutDashboard className="size-4" /> {s.name}
                    {s.phoneHome && <Smartphone className="text-muted-foreground ml-auto size-3.5" />}
                  </NavLink>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => void setPhoneHome(s.id)}>
                  <Smartphone className="size-4" /> Use as phone home
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          {screens.length === 0 && (
            <button
              className="text-muted-foreground hover:bg-accent/50 w-full rounded-md px-2 py-1.5 text-left text-sm"
              onClick={() => setNewOpen(true)}
            >
              + Create a screen
            </button>
          )}
        </Section>

        <Section id="surfaces" title="Surfaces">
          <NavLink to="/calendar" className={navClass}>
            <CalendarDays className="size-4" /> Calendar
          </NavLink>
          <NavLink to="/week" className={navClass}>
            <Columns3 className="size-4" /> Week
          </NavLink>
          <NavLink to="/schedule" className={navClass}>
            <Clock className="size-4" /> Schedule
          </NavLink>
          <NavLink to="/map" className={navClass}>
            <MapPin className="size-4" /> Map
          </NavLink>
          <NavLink to="/graph" className={navClass}>
            <Waypoints className="size-4" /> Graph
          </NavLink>
        </Section>

        <Section id="apps" title="Apps">
          {sections.map((section) => {
            const rows = section.screens.map((s) => {
              const Icon = s.icon;
              return (
                <NavLink key={s.id} to={screenRoute(s)} className={navClass}>
                  {Icon ? <Icon className="size-4" /> : <span className="size-4" />} {s.title}
                </NavLink>
              );
            });
            if (!section.group) return rows;
            const id = section.group.id;
            return (
              <NavGroup key={id} title={section.group.title} open={openGroups.includes(id)} active={activeGroup === id} onToggle={() => toggleGroup(id)}>
                {rows}
              </NavGroup>
            );
          })}
        </Section>

        <Section
          id="bases"
          title="Bases"
          actions={
            <Button size="icon" variant="ghost" className="size-5" title="Document types" onClick={() => navigate("/base")}>
              <Settings2 className="size-3.5" />
            </Button>
          }
        >
          {baseShelves.map(({ module, types: shelf }) => {
            const rows = shelf.map((t) => {
              const Icon = t.icon ?? Table2;
              return (
                <ContextMenu key={t.id}>
                  {/* Radix asChild merges className, which mangles NavLink's className function — keep the function on the NavLink inside a plain trigger div. */}
                  <ContextMenuTrigger asChild>
                    <div>
                      <NavLink to={basePath(t.id)} className={navClass}>
                        <Icon className="size-4" /> {t.label}
                      </NavLink>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onClick={() => toggleHiddenBase(t.id)}>
                      <EyeOff className="size-4" /> Hide from sidebar
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            });
            if (!module) return rows;
            return (
              <NavGroup
                key={`base-${module}`}
                title={module}
                open={openGroups.includes(`base:${module}`)}
                active={false}
                onToggle={() => toggleGroup(`base:${module}`)}
              >
                {rows}
              </NavGroup>
            );
          })}
        </Section>
      </nav>

      <Separator />
      <div className="p-2">
        <SyncBadge />
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>New screen</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Morning review"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void createScreen()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createScreen()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
