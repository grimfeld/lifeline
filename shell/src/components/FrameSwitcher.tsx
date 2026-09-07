import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { cn } from "@lifeline/ui";
import { DASHBOARD_FRAME, frameOfPath, frames } from "@lifeline/core";
import { LayoutDashboard } from "lucide-react";

const LAST_KEY = (id: string) => `ws:last:${id}`;

/** Every frame: Core's dashboard first, then App-provided ones. */
function allFrames() {
  return [{ id: DASHBOARD_FRAME, title: "Dashboard", icon: LayoutDashboard, path: "/", home: "" }, ...frames()];
}

/** Where a frame was last (localStorage), else its root. */
export function lastLocation(id: string): string {
  const w = allFrames().find((w) => w.id === id);
  const root = w ? (w.path === "/" ? "/" : w.path) : "/";
  try {
    return localStorage.getItem(LAST_KEY(id)) ?? root;
  } catch {
    return root;
  }
}

/** Remembers each frame's last location and binds ⌘1/⌘2… to switch (ADR 0012). Mount once. */
export function useFrameMemory() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const id = frameOfPath(location.pathname);
    try {
      localStorage.setItem(LAST_KEY(id), location.pathname + location.search);
    } catch {
      /* private mode */
    }
  }, [location.pathname, location.search]);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const list = allFrames();
      const target = list[n - 1];
      if (!target) return;
      e.preventDefault();
      navigate(lastLocation(target.id));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

/** Segmented control at the top of every frame sidebar. */
export function FrameSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();
  const current = frameOfPath(location.pathname);
  const list = allFrames();
  if (list.length < 2) return null;
  return (
    <div className="bg-muted/60 mx-2 mt-2 grid gap-0.5 rounded-lg p-0.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }} role="tablist" aria-label="Frame">
      {list.map((w, i) => {
        const Icon = w.icon;
        const active = w.id === current;
        return (
          <button
            key={w.id}
            role="tab"
            aria-selected={active}
            title={`${w.title} (⌘${i + 1})`}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => !active && navigate(lastLocation(w.id))}
          >
            {Icon && <Icon className="size-3.5" />}
            {w.title}
          </button>
        );
      })}
    </div>
  );
}
