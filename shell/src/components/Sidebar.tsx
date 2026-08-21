import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router";
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
  basePath,
  db,
  newId,
  put,
  screensOf,
  useDocumentTypes,
  useLiveQuery,
  type UserScreen,
} from "@lifeline/core";
import { CalendarDays, ChevronRight, Clock, Columns3, EyeOff, LayoutDashboard, MapPin, Plus, Settings2, Smartphone, Sparkles, Table2, Waypoints } from "lucide-react";
import { SyncBadge } from "./SyncBadge";
import { setPhoneHome } from "../mobile/phoneHome";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useCollapsedSections, useHiddenBases } from "./sidebarPrefs";

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

export function Sidebar({ className }: { className?: string } = {}) {
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

  const types = useDocumentTypes().filter((t) => !t.internal);
  const [hiddenBases, toggleHiddenBase] = useHiddenBases();
  const screens = useLiveQuery(
    () =>
      db()
        .collection<UserScreen>("screens")
        .where("deleted")
        .equals(0)
        .sortBy("sort"),
    [],
    [] as UserScreen[],
  );

  async function createScreen() {
    if (!name.trim()) return;
    const id = newId();
    await put<UserScreen>("screens", {
      id,
      name: name.trim(),
      layout: [],
      sort: screens.length,
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
      <WorkspaceSwitcher />
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
          {screensOf()
            .filter((s) => !s.hidden)
            .map((s) => {
              const Icon = s.icon;
              return (
                <NavLink key={s.id} to={`/app/${s.path}`} className={navClass}>
                  {Icon ? <Icon className="size-4" /> : <span className="size-4" />} {s.title}
                </NavLink>
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
          {types
            .filter((t) => !hiddenBases.includes(t.id))
            .map((t) => {
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
