import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Separator,
} from "@lifeline/ui";
import {
  db,
  newId,
  put,
  screensOf,
  useLiveQuery,
  type UserScreen,
} from "@lifeline/core";
import { CalendarDays, Columns3, LayoutDashboard, MapPin, Plus, Sparkles } from "lucide-react";
import { SyncBadge } from "./SyncBadge";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");

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
    <aside className="bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r">
      <div className="flex items-center gap-2 px-4 py-3">
        <Sparkles className="text-primary size-5" />
        <span className="text-base font-semibold tracking-tight">Lifeline</span>
      </div>
      <WorkspaceSwitcher />
      <Separator className="mt-2" />

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        <div>
          <div className="text-muted-foreground flex items-center justify-between px-2 py-1 text-xs font-medium">
            Screens
            <Button
              size="icon"
              variant="ghost"
              className="size-5"
              title="New screen"
              onClick={() => setNewOpen(true)}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
          {screens.map((s) => (
            <NavLink key={s.id} to={`/screen/${s.id}`} className={navClass}>
              <LayoutDashboard className="size-4" /> {s.name}
            </NavLink>
          ))}
          {screens.length === 0 && (
            <button
              className="text-muted-foreground hover:bg-accent/50 w-full rounded-md px-2 py-1.5 text-left text-sm"
              onClick={() => setNewOpen(true)}
            >
              + Create a screen
            </button>
          )}
        </div>

        <div>
          <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Surfaces</div>
          <NavLink to="/calendar" className={navClass}>
            <CalendarDays className="size-4" /> Calendar
          </NavLink>
          <NavLink to="/week" className={navClass}>
            <Columns3 className="size-4" /> Week
          </NavLink>
          <NavLink to="/map" className={navClass}>
            <MapPin className="size-4" /> Map
          </NavLink>
        </div>

        <div>
          <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Apps</div>
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
        </div>
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
