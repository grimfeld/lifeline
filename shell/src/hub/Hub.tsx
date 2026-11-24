import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation } from "react-router";
import { Button, ContentContainer, cn, Tip } from "@lifeline/ui";
import {
  SURFACES,
  boxInPixels,
  frontWindow,
  moduleById,
  moduleHome,
  useWorkspaceModules,
  type Box,
  type Stage,
  type WindowState,
} from "@lifeline/core";
import { CircleHelp, LayoutDashboard, Settings, Table2, X } from "lucide-react";
import { MODULE_ICONS, SURFACE_ICONS } from "../navIcons";
import { guideHref, guideSlugForPath } from "../guide/guidePlace";
import { placeTitle } from "../nav/placeTitle";
import { SyncBadge } from "../components/SyncBadge";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { RouteBoundary } from "../components/ErrorBoundary";
import { Places } from "../Places";
import { WindowRouter } from "./WindowRouter";
import { useDesk } from "./useDesk";

type Icon = React.ComponentType<{ className?: string }>;

/** A Window's title: its Module's or Surface's, or the page's. Fixed in code, never user text. */
export function windowTitle(win: Pick<WindowState, "target" | "route">): string {
  if (win.target === "screens") return "Screens";
  const m = moduleById(win.target);
  if (m) return m.title;
  const s = SURFACES.find((x) => x.id === win.target);
  if (s) return s.title;
  return placeTitle(win.route.split(/[?#]/)[0]!) ?? "Lifeline";
}

/**
 * The **Hub** (ADR 0133): Core's chrome on the desk. A top bar, an index of the
 * Workspace's Modules and the general Surfaces, and the stage, where each one
 * opens in its own Window.
 */
export function Hub() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => setStage({ width: el.clientWidth, height: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const desk = useDesk(stage);
  const front = frontWindow(desk.layout);

  // Opening a Window moves focus into it; closing one returns focus to its index row.
  const lastCount = useRef(desk.layout.windows.length);
  const closedTarget = useRef<string | null>(null);
  useEffect(() => {
    const count = desk.layout.windows.length;
    if (count > lastCount.current && front) document.getElementById(windowDomId(front.id))?.focus({ preventScroll: true });
    if (count < lastCount.current && closedTarget.current) document.querySelector<HTMLElement>(`[data-hub-row="${closedTarget.current}"]`)?.focus();
    lastCount.current = count;
  }, [desk.layout.windows.length, front]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <HubIndex
          windows={desk.layout.windows}
          frontId={front?.id}
          onFocus={desk.focus}
        />
        <div ref={stageRef} data-hub-stage="" className="bg-muted/40 relative isolate min-w-0 flex-1 overflow-hidden">
          {desk.layout.windows.length === 0 && <EmptyStage />}
          {stage &&
            desk.layout.windows.map((win, i) => (
              <WindowFrame
                key={win.id}
                win={win}
                z={i + 1}
                front={win.id === front?.id}
                stage={stage}
                onFocus={() => desk.focus(win.id)}
                onClose={() => {
                  closedTarget.current = win.target;
                  desk.close(win.id);
                }}
                onPlace={(box) => desk.act({ type: "place", id: win.id, box, stage })}
                onNavigate={(to, replace) => desk.navigateFrom(win.id, to, replace)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

const windowDomId = (id: string) => `window-${id.replace(/[^\w-]/g, "-")}`;

function EmptyStage() {
  return (
    <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-8 text-center text-sm">
      <p className="max-w-sm">Nothing is open. Pick a Module on the left: each opens in its own Window.</p>
    </div>
  );
}

/** LIFELINE, the Workspace, Bases, the sync status, the date and the time. */
function TopBar() {
  return (
    <header className="bg-sidebar text-sidebar-foreground flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <span className="text-xs font-semibold tracking-[0.2em]">LIFELINE</span>
      <div className="w-48 min-w-0">
        <WorkspacePicker />
      </div>
      <Button asChild variant="ghost" size="sm">
        <Link to="/base">
          <Table2 /> Bases
        </Link>
      </Button>
      <div className="ml-auto flex items-center gap-3">
        <SyncBadge />
        <Clock />
      </div>
    </header>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  const date = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
      {date} · <time>{time}</time>
    </span>
  );
}

interface IndexRow {
  key: string;
  title: string;
  to: string;
  icon: Icon;
}

/** The Workspace's Modules in its order, then the Surfaces, then the Guide and Settings at the foot. */
function HubIndex({ windows, frontId, onFocus }: { windows: WindowState[]; frontId?: string; onFocus: (id: string) => void }) {
  const { pathname } = useLocation();
  const modules = useWorkspaceModules();
  const moduleRows: IndexRow[] = modules.flatMap((id) => {
    const m = moduleById(id);
    return m ? [{ key: m.id, title: m.title, to: moduleHome(m), icon: MODULE_ICONS[m.id] ?? LayoutDashboard }] : [];
  });
  const surfaceRows: IndexRow[] = [
    ...SURFACES.map((s) => ({ key: s.id, title: s.title, to: s.path, icon: SURFACE_ICONS[s.id] ?? LayoutDashboard })),
    { key: "screens", title: "Screens", to: "/screens", icon: LayoutDashboard },
  ];
  const footRows: IndexRow[] = [
    { key: "page:guide", title: "Guide", to: guideHref(guideSlugForPath(pathname)), icon: CircleHelp },
    { key: "page:settings", title: "Settings", to: "/settings", icon: Settings },
  ];
  const row = (r: IndexRow) => {
    const win = windows.find((w) => w.target === r.key);
    return <IndexLink key={r.key} row={r} open={!!win} front={!!win && win.id === frontId} onFocus={win ? () => onFocus(win.id) : undefined} />;
  };
  return (
    <nav aria-label="Hub" className="bg-sidebar text-sidebar-foreground flex w-52 shrink-0 flex-col border-r">
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-2">
        {moduleRows.map(row)}
        <div className="bg-border mx-2 my-1.5 h-px shrink-0" />
        {surfaceRows.map(row)}
      </div>
      <div className="flex flex-col gap-0.5 border-t p-2">{footRows.map(row)}</div>
    </nav>
  );
}

function IndexLink({ row, open, front, onFocus }: { row: IndexRow; open: boolean; front: boolean; onFocus?: () => void }) {
  const Icon = row.icon;
  return (
    <Link
      to={row.to}
      data-hub-row={row.key}
      aria-current={front ? "page" : undefined}
      onClick={(e) => {
        // An open Window comes to the front where it stands, not back on its home.
        if (onFocus) {
          e.preventDefault();
          onFocus();
        }
      }}
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        front ? "bg-accent text-primary font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{row.title}</span>
      {open && <span aria-label="Open" className={cn("size-1.5 shrink-0 rounded-full", front ? "bg-primary" : "bg-muted-foreground/60")} />}
    </Link>
  );
}

/**
 * One Window: a labelled region with a bar (drag it to move, its title, close),
 * a corner to size it from, and its content under its own router, in its own
 * content container. It stays mounted behind the others.
 */
function WindowFrame({
  win,
  z,
  front,
  stage,
  onFocus,
  onClose,
  onPlace,
  onNavigate,
}: {
  win: WindowState;
  z: number;
  front: boolean;
  stage: Stage;
  onFocus: () => void;
  onClose: () => void;
  onPlace: (box: Box) => void;
  onNavigate: (to: string, replace: boolean) => void;
}) {
  const title = windowTitle(win);
  const px = boxInPixels(win, stage);
  // While dragging, the box follows the pointer here; it is placed (and clamped) on release.
  const [drag, setDrag] = useState<Box | null>(null);
  const shown = drag ?? px;

  const startDrag = (e: ReactPointerEvent, kind: "move" | "size") => {
    if (e.button !== 0) return;
    if (kind === "move" && (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const from = px;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    let last: Box = from;
    const moveTo = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      last = kind === "move" ? { ...from, x: from.x + dx, y: from.y + dy } : { ...from, w: from.w + dx, h: from.h + dy };
      setDrag(last);
    };
    const end = () => {
      el.removeEventListener("pointermove", moveTo);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      setDrag(null);
      if (last !== from) onPlace({ x: last.x / stage.width, y: last.y / stage.height, w: last.w / stage.width, h: last.h / stage.height });
    };
    el.addEventListener("pointermove", moveTo);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  };

  return (
    <section
      id={windowDomId(win.id)}
      aria-label={title}
      tabIndex={-1}
      data-window={win.target}
      data-front={front ? "" : undefined}
      onPointerDownCapture={() => !front && onFocus()}
      onFocusCapture={() => !front && onFocus()}
      style={{ left: shown.x, top: shown.y, width: shown.w, height: shown.h, zIndex: z }}
      className={cn(
        "bg-background absolute flex flex-col overflow-hidden rounded-lg border shadow-lg outline-none",
        front ? "ring-primary/30 shadow-xl ring-1" : "",
        win.mode === "maximised" && "rounded-none border-0 shadow-none ring-0",
      )}
    >
      <div
        data-window-bar=""
        onPointerDown={(e) => startDrag(e, "move")}
        className={cn("bg-sidebar flex h-9 shrink-0 cursor-default touch-none items-center gap-2 border-b pr-1 pl-3 select-none", front && "border-t-primary border-t-2")}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <Tip label={`Close ${title}`}>
          <Button size="icon-sm" variant="ghost" onClick={onClose}>
            <X />
          </Button>
        </Tip>
      </div>
      <ContentContainer className="flex min-h-0 flex-1 overflow-hidden">
        <WindowRouter route={win.route} onNavigate={onNavigate}>
          {/* A Module that throws breaks its own Window, never the Hub or the others (#301). */}
          <RouteBoundary>
            <Places />
          </RouteBoundary>
        </WindowRouter>
      </ContentContainer>
      {win.mode !== "maximised" && (
        <div
          aria-hidden
          data-window-corner=""
          onPointerDown={(e) => startDrag(e, "size")}
          className="absolute right-0 bottom-0 size-4 cursor-se-resize touch-none"
        />
      )}
    </section>
  );
}
