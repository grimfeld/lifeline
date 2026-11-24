import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useLocation } from "react-router";
import { Button, ContentContainer, cn, Tip } from "@lifeline/ui";
import {
  BAR_HEIGHT,
  LEFT_HALF,
  RIGHT_HALF,
  WHOLE_STAGE,
  restoredUnderPointer,
  snapZone,
  DESK_SURFACES,
  pageTarget,
  pathOnly,
  boxInPixels,
  frontWindow,
  moduleById,
  moduleHome,
  useWorkspaceModules,
  type Box,
  type Stage,
  type WindowState,
} from "@lifeline/core";
import { CircleHelp, Expand, LayoutDashboard, Maximize2, Minimize2, PanelLeft, PanelRight, Settings, Table2, X } from "lucide-react";
import { MODULE_ICONS, SURFACE_ICONS } from "../navIcons";
import { guideHref, guideSlugForPath } from "../guide/guidePlace";
import { placeTitle } from "../nav/placeTitle";
import { SyncBadge } from "../components/SyncBadge";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { RouteBoundary } from "../components/ErrorBoundary";
import { Places } from "../Places";
import { WindowRouter } from "./WindowRouter";
import { useDesk } from "./useDesk";
import { isPageRoute } from "./desk";
import { hubTakesEscape } from "./escape";
import { setDeskControls } from "./windowCommands";

type Icon = React.ComponentType<{ className?: string }>;

/** A Window's title: its Module's or Surface's, or the page's. Fixed in code, never user text. */
export function windowTitle(win: Pick<WindowState, "target" | "route">): string {
  const m = moduleById(win.target);
  if (m) return m.title;
  const s = DESK_SURFACES.find((x) => x.id === win.target);
  if (s) return s.title;
  return placeTitle(pathOnly(win.route)) ?? "Lifeline";
}

/**
 * The **Hub** (ADR 0133): Core's chrome on the desk. A top bar, an index of the
 * Workspace's Modules and the general Surfaces, and the stage, where each one
 * opens in its own Window. A Window in full screen hides the chrome; a
 * full-screen page (Bases, the Vault, Settings, the Guide…) opens over all of
 * it, and Esc leaves either (#663).
 */
export function Hub() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const page = isPageRoute(pathname);
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
  const [outline, setOutline] = useState<Box | null>(null);
  const front = frontWindow(desk.layout);
  const full = front?.mode === "full";

  // The Window Commands act on the front Window through this (#663): none
  // under a full-screen page, where no Window is in view to act on.
  const { act, close, closePage } = desk;
  const commandFront = page ? undefined : front;
  useEffect(() => {
    setDeskControls({ front: commandFront, act, close });
  }, [commandFront, act, close]);
  useEffect(() => () => setDeskControls(null), []);

  // Esc closes a full-screen page, or leaves full screen, unless what has
  // focus keeps its own Esc (hubTakesEscape). Read through a ref, kept current
  // after each commit, so the listener is added once.
  const escape = useRef<() => boolean>(() => false);
  const onEscape = () => {
    if (page) {
      closePage();
      return true;
    }
    if (front?.mode !== "full") return false;
    act({ type: "fullScreen", id: front.id });
    return true;
  };
  useLayoutEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || e.isComposing) return;
      if (!hubTakesEscape(e.target, rootRef.current)) return;
      if (escape.current()) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Opening a Window moves focus into it; closing one returns focus to its index row.
  // Keyed on what happened — a Window id new since the last render, a close asked
  // for — never on the count: a page leaving as another opens keeps it level.
  const known = useRef<Set<string> | null>(null);
  const closedTarget = useRef<string | null>(null);
  const ids = desk.layout.windows.map((w) => w.id).join(" ");
  useEffect(() => {
    const now = new Set(ids ? ids.split(" ") : []);
    // The first layout (a reload, a restored desk) moves nothing: the person did not open it.
    const opened = known.current ? [...now].find((id) => !known.current!.has(id)) : undefined;
    known.current = now;
    if (opened) document.getElementById(windowDomId(opened))?.focus({ preventScroll: true });
    else if (closedTarget.current) {
      const row = document.querySelector<HTMLElement>(`[data-hub-row="${closedTarget.current}"]`) ?? document.querySelector<HTMLElement>("[data-hub-row]");
      row?.focus();
    }
    closedTarget.current = null;
    // A Window gone mid-drag (closed, or a Workspace switch) takes its outline with it.
    setOutline(null);
  }, [ids]);
  // Entering full screen moves focus into the Window, unless it is there
  // already (its own button): the Hub's chrome it may have been on is gone.
  const fullId = full ? front?.id : undefined;
  useEffect(() => {
    if (!fullId) return;
    const el = document.getElementById(windowDomId(fullId));
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, [fullId]);
  // Windows render in a fixed order — stacking is z-index alone — so bringing one
  // to the front never moves its node (which would drop focus and pointer capture).
  const byId = [...desk.layout.windows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const maximisedFront = front?.mode === "maximised" || front?.mode === "full";

  return (
    <div ref={rootRef} className="relative isolate flex min-h-0 flex-1 flex-col">
      {/* Under a full-screen page, the Hub is out of reach until it closes. */}
      <div inert={page || undefined} className="flex min-h-0 flex-1 flex-col">
        {/* A Window in full screen hides the Hub's chrome: the stage is the whole display. */}
        {!full && <TopBar />}
        <div className="flex min-h-0 flex-1">
          {!full && (
            <HubIndex
              windows={desk.layout.windows}
              frontId={front?.id}
              onFocus={desk.focus}
            />
          )}
          <div ref={stageRef} data-hub-stage="" className="bg-muted/40 relative isolate min-w-0 flex-1 overflow-hidden">
            {desk.layout.windows.length === 0 && <EmptyStage />}
            {/* What a drop would fill, while a Window is dragged over a snap zone. Above every Window. */}
            {outline && stage && (
              <div
                aria-hidden
                data-snap-outline=""
                className="border-primary bg-primary/15 pointer-events-none absolute rounded-lg border-2 transition-all duration-100 motion-reduce:transition-none"
                style={{ left: outline.x * stage.width, top: outline.y * stage.height, width: outline.w * stage.width, height: outline.h * stage.height, zIndex: desk.layout.windows.length + 1 }}
              />
            )}
            {stage &&
              byId.map((win) => (
                <WindowFrame
                  key={win.id}
                  win={win}
                  z={desk.layout.windows.indexOf(win) + 1}
                  front={win.id === front?.id}
                  covered={maximisedFront && win.id !== front?.id}
                  stage={stage}
                  onFocus={() => desk.focus(win.id)}
                  onClose={() => {
                    closedTarget.current = win.target;
                    desk.close(win.id);
                  }}
                  onPlace={(box) => desk.act({ type: "place", id: win.id, box, stage })}
                  onSnap={(box) => desk.act({ type: "snap", id: win.id, box })}
                  onToggleMaximise={() => desk.act({ type: "toggle", id: win.id, stage })}
                  onMaximise={() => desk.act({ type: "maximise", id: win.id })}
                  onFullScreen={() => desk.act({ type: "fullScreen", id: win.id })}
                  // The same zone keeps the same state: no re-render of every Window on each pointer move.
                  onZone={(next) => setOutline((prev) => (sameBox(prev, next) ? prev : next))}
                  onNavigate={(to, replace) => desk.navigateFrom(win.id, to, replace)}
                />
              ))}
          </div>
        </div>
      </div>
      {page && <FullScreenPage onClose={closePage} />}
    </div>
  );
}

/**
 * A full-screen page (#663): Bases, the Vault, Settings, the Guide, a
 * Module-less App screen, over the whole Hub. It is a route: the browser's
 * router shows it, and closing it (or Esc) returns to the Hub as it was.
 */
function FullScreenPage({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation();
  const title = placeTitle(pathname) ?? "Lifeline";
  const ref = useRef<HTMLElement>(null);
  // Focus moves into the page, and back to where it was when the page closes.
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, []);
  return (
    <section ref={ref} aria-label={title} tabIndex={-1} data-full-page="" className="bg-background absolute inset-0 z-10 flex flex-col outline-none">
      <div data-page-bar="" style={{ height: BAR_HEIGHT }} className="bg-sidebar flex shrink-0 items-center gap-2 border-b pr-1 pl-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <span aria-hidden className="text-muted-foreground shrink-0 text-xs">Esc</span>
        <Tip label={`Close ${title}`}>
          <Button size="icon-sm" variant="ghost" aria-keyshortcuts="Escape" onClick={onClose}>
            <X />
          </Button>
        </Tip>
      </div>
      <ContentContainer className="flex min-h-0 flex-1 overflow-hidden">
        <RouteBoundary>
          <Places />
        </RouteBoundary>
      </ContentContainer>
    </section>
  );
}

/** Below this many CSS px of travel, a press on the bar is a click, not a drag. */
const DRAG_THRESHOLD = 4;
/** Whether an event started on one of the bar's buttons (they are clicked, never dragged). */
const onButton = (e: { target: EventTarget }) => !!(e.target as HTMLElement).closest("button");
const sameBox = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
const sameZone = (a: Box | "max" | null, b: Box | "max" | null) => (a === "max" || b === "max" ? a === b : sameBox(a, b));

const windowDomId = (id: string) => `window-${id.replace(/[^\w-]/g, "-")}`;

function EmptyStage() {
  return (
    <div className="text-muted-foreground absolute inset-0 flex items-center justify-center p-8 text-center text-sm">
      <p className="max-w-sm">
        Nothing is open. Pick a Module on the left: each opens in its own Window. Drag a Window to an edge to snap it to a half, or near a corner for a quarter.
      </p>
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
  const surfaceRows: IndexRow[] = DESK_SURFACES.map((s) => ({ key: s.id, title: s.title, to: s.path, icon: SURFACE_ICONS[s.id] ?? LayoutDashboard }));
  const footRows: IndexRow[] = [
    { key: pageTarget("guide"), title: "Guide", to: guideHref(guideSlugForPath(pathname)), icon: CircleHelp },
    { key: pageTarget("settings"), title: "Settings", to: "/settings", icon: Settings },
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
      {/* The Guide and Settings are full-screen pages, never Windows: plain links. */}
      <div className="flex flex-col gap-0.5 border-t p-2">
        {footRows.map((r) => (
          <IndexLink key={r.key} row={r} open={false} front={false} />
        ))}
      </div>
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
      {open && (
        <>
          <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", front ? "bg-primary" : "bg-muted-foreground/60")} />
          <span className="sr-only">, open</span>
        </>
      )}
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
  covered,
  stage,
  onFocus,
  onClose,
  onPlace,
  onSnap,
  onToggleMaximise,
  onMaximise,
  onFullScreen,
  onZone,
  onNavigate,
}: {
  win: WindowState;
  z: number;
  front: boolean;
  /** Wholly hidden behind a maximised front Window: out of the tab order and the reading order. */
  covered: boolean;
  stage: Stage;
  onFocus: () => void;
  onClose: () => void;
  onPlace: (box: Box) => void;
  /** Snap to a half or a quarter, or maximise ("max"). */
  onSnap: (box: Box | "max") => void;
  /** The bar's double-click: maximise, or restore a maximised or snapped Window. */
  onToggleMaximise: () => void;
  /** The bar's button: maximise, or restore a maximised Window (a snapped one maximises). */
  onMaximise: () => void;
  /** Into full screen, or back. */
  onFullScreen: () => void;
  /** The zone a drop would fill while the bar is dragged over one (fractions), for the stage's outline. */
  onZone: (zone: Box | null) => void;
  onNavigate: (to: string, replace: boolean) => void;
}) {
  const title = windowTitle(win);
  const px = boxInPixels(win, stage);
  const full = win.mode === "full";
  const filling = full || win.mode === "maximised";
  // While dragging, the box follows the pointer here; it is placed (and clamped) on release.
  const [drag, setDrag] = useState<Box | null>(null);
  const shown = drag ?? px;

  const startDrag = (e: ReactPointerEvent, kind: "move" | "size") => {
    if (e.button !== 0) return;
    if (kind === "move" && onButton(e)) return;
    // In full screen a Window stays where it is: "Hub · Esc" first.
    if (full) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    const el = e.currentTarget as HTMLElement;
    const rect = el.closest("[data-hub-stage]")?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const inStage = (ev: { clientX: number; clientY: number }) => ({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    // Dragged away, a snapped or maximised Window takes back the size it had,
    // under the point of the bar the pointer took.
    const from = kind === "move" ? restoredUnderPointer(win, px, start.x - rect.left, stage) : px;
    // A bar at the top of the stage is pressed inside a snap zone: snapping arms
    // only once the pointer has left the zone it was pressed in, so a click
    // (or a wobble) on a maximised or snapped Window's bar never re-snaps it.
    const pressedIn = snapZone(inStage(e), stage);
    let armed = false;
    el.setPointerCapture(e.pointerId);
    let last: Box | null = null;
    let zone: Box | "max" | null = null;
    const moveTo = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!last && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      last = kind === "move" ? { ...from, x: from.x + dx, y: from.y + dy } : { ...from, w: from.w + dx, h: from.h + dy };
      setDrag(last);
      if (kind !== "move") return;
      const over = snapZone(inStage(ev), stage);
      if (!armed && !sameZone(over, pressedIn)) armed = true;
      zone = armed ? over : null;
      onZone(zone === "max" ? WHOLE_STAGE : zone);
    };
    const stop = () => {
      el.removeEventListener("pointermove", moveTo);
      el.removeEventListener("pointerup", drop);
      el.removeEventListener("pointercancel", stop);
      setDrag(null);
      onZone(null);
    };
    // A drag the system cancels is abandoned: nothing is placed or snapped.
    const drop = () => {
      stop();
      if (!last) return;
      if (zone) onSnap(zone);
      else onPlace({ x: last.x / stage.width, y: last.y / stage.height, w: last.w / stage.width, h: last.h / stage.height });
    };
    el.addEventListener("pointermove", moveTo);
    el.addEventListener("pointerup", drop);
    el.addEventListener("pointercancel", stop);
  };

  return (
    <section
      id={windowDomId(win.id)}
      aria-label={title}
      tabIndex={-1}
      data-window={win.target}
      data-front={front ? "" : undefined}
      inert={covered || undefined}
      onPointerDownCapture={() => !front && onFocus()}
      onFocusCapture={() => !front && onFocus()}
      style={{ left: shown.x, top: shown.y, width: shown.w, height: shown.h, zIndex: z }}
      className={cn(
        "bg-background absolute flex flex-col overflow-hidden rounded-lg border shadow-lg outline-none",
        front ? "ring-primary/30 shadow-xl ring-1" : "",
        filling && "rounded-none border-0 shadow-none ring-0",
      )}
    >
      <div
        data-window-bar=""
        onPointerDown={(e) => startDrag(e, "move")}
        onDoubleClick={(e) => {
          if (!onButton(e) && !full) onToggleMaximise();
        }}
        // The bar's height is core's BAR_HEIGHT: the part of a Window always kept on the stage.
        style={{ height: BAR_HEIGHT }}
        className={cn("bg-sidebar flex shrink-0 cursor-default touch-none items-center gap-2 border-b pr-1 pl-3 select-none", front && "border-t-primary border-t-2")}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        {!full && (
          <Tip label="Snap left half">
            <Button size="icon-sm" variant="ghost" onClick={() => onSnap(LEFT_HALF)}>
              <PanelLeft />
            </Button>
          </Tip>
        )}
        {!full && (
          <Tip label="Snap right half">
            <Button size="icon-sm" variant="ghost" onClick={() => onSnap(RIGHT_HALF)}>
              <PanelRight />
            </Button>
          </Tip>
        )}
        {!full && (
          <Tip label={win.mode === "maximised" ? "Restore" : "Maximise"}>
            <Button size="icon-sm" variant="ghost" onClick={onMaximise}>
              {win.mode === "maximised" ? <Minimize2 /> : <Maximize2 />}
            </Button>
          </Tip>
        )}
        {/* One button both ways, so focus stays on it: in full screen it names the way back. */}
        <Tip label={full ? "Hub · Esc" : "Full screen"}>
          <Button size={full ? "sm" : "icon-sm"} variant={full ? "outline" : "ghost"} aria-keyshortcuts={full ? "Escape" : undefined} onClick={onFullScreen}>
            {full ? "Hub · Esc" : <Expand />}
          </Button>
        </Tip>
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
      {!filling && (
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
