import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  SURFACES,
  frontWindow,
  loadWindowLayout,
  newDesk,
  routeTarget,
  saveWindowLayout,
  useCurrentWorkspaceId,
  useWorkspaceModules,
  windowsReducer,
  type Stage,
  type WindowAction,
  type WindowLayout,
} from "@lifeline/core";
import { lastPlace } from "../nav/resume";

/** The full path of a location: what a Window's route holds. */
const fullPath = (l: { pathname: string; search: string; hash: string }) => l.pathname + l.search + l.hash;

type DeskAction = WindowAction | { type: "load"; layout: WindowLayout };

const isPage = (target: string) => target.startsWith("page:");

/**
 * A page (Bases, Settings, the Guide, the Vault, a Handoff) is not a place
 * kept on the desk: until it opens full screen over the Hub (#663), its Window
 * goes the moment another one comes to the front, as leaving a page did.
 */
function dropPagesBehind(layout: WindowLayout): WindowLayout {
  const front = frontWindow(layout);
  const windows = layout.windows.filter((w) => w === front || !isPage(w.target));
  return windows.length === layout.windows.length ? layout : { ...layout, windows };
}

function deskReducer(layout: WindowLayout, action: DeskAction): WindowLayout {
  if (action.type === "load") return action.layout;
  const next = windowsReducer(layout, action);
  return action.type === "open" || action.type === "focus" ? dropPagesBehind(next) : next;
}

/**
 * The layout a Workspace opens with on this device: its saved one, or a new
 * desk — one maximised Window on the address asked for, or on the last place
 * (what `/` resolves to).
 */
function initialLayout(workspaceId: string, asked = "/"): WindowLayout {
  const saved = loadWindowLayout(workspaceId);
  if (saved) return saved;
  const place = asked.split(/[?#]/)[0] === "/" ? lastPlace(workspaceId) : asked;
  return newDesk(routeTarget(place.split(/[?#]/)[0]!).target, place);
}

/**
 * The desk's state (ADR 0133): the window layout of the current Workspace,
 * saved on this device, and kept in step with the browser's URL.
 *
 * The URL is the front Window's route. Every navigation — inside a Window, from
 * the palette, a Peek, a Card, Back and Forward, a typed URL — goes through the
 * browser; when the URL changes, the Window its route belongs to opens there,
 * or comes to the front on it. Focusing a Window puts its route in the URL.
 */
export function useDesk(stage: Stage | null) {
  const workspaceId = useCurrentWorkspaceId();
  const modules = useWorkspaceModules();
  const location = useLocation();
  const navigate = useNavigate();
  const [layout, dispatch] = useReducer(deskReducer, workspaceId, (id) => initialLayout(id, fullPath(window.location)));
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const fallbackStage = { width: 1280, height: 720 };

  // Each Workspace keeps its own Windows: switching swaps the set.
  const loadedFor = useRef(workspaceId);
  useEffect(() => {
    if (loadedFor.current === workspaceId) return;
    const first = loadedFor.current === "";
    loadedFor.current = workspaceId;
    // The Workspace becomes known after the first paint (the first pull): the
    // desk on screen is already this Workspace's, so it is adopted, not replaced.
    if (first && !loadWindowLayout(workspaceId)) return;
    let next = initialLayout(workspaceId);
    // A page in front (a Handoff choosing its Workspace) stays where it is, in front of the new set.
    const page = frontWindow(layoutRef.current);
    if (page && isPage(page.target)) next = { ...next, windows: [...next.windows.filter((w) => w.target !== page.target), page] };
    dispatch({ type: "load", layout: next });
    const front = frontWindow(next);
    navigate(front ? front.route : "/", { replace: true });
  }, [workspaceId, navigate]);

  // Saved on every change, per device and per Workspace.
  useEffect(() => {
    if (loadedFor.current === workspaceId) saveWindowLayout(workspaceId, layout);
  }, [layout, workspaceId]);

  // A Window whose Module the Workspace no longer takes is dropped.
  const moduleKey = modules.join(",");
  useEffect(() => {
    // An empty list is a Workspace not loaded yet, never one that took every Module away.
    if (modules.length === 0) return;
    const targets = [...modules, ...SURFACES.map((s) => s.id), "screens"];
    dispatch({ type: "prune", targets: [...targets, ...layout.windows.filter((w) => isPage(w.target)).map((w) => w.target)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a change of the Workspace's Modules only
  }, [moduleKey]);

  // The URL drives the front Window.
  const path = fullPath(location);
  useEffect(() => {
    const front = frontWindow(layoutRef.current);
    if (location.pathname === "/") {
      // `/` is "the desk as it was": the front Window's route, or the empty stage.
      if (front) navigate(front.route, { replace: true });
      return;
    }
    if (front && front.route === path) return;
    const { target } = routeTarget(location.pathname);
    dispatch({ type: "open", target, route: path, stage: stageRef.current ?? fallbackStage });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the URL alone
  }, [path]);

  /** Bring a Window to the front, its route into the URL. */
  const focus = useCallback(
    (id: string) => {
      const win = layoutRef.current.windows.find((w) => w.id === id);
      if (!win) return;
      if (frontWindow(layoutRef.current)?.id === id) return;
      dispatch({ type: "focus", id });
      navigate(win.route);
    },
    [navigate],
  );

  /** Close a Window; the one behind it comes to the front, or the stage empties. */
  const close = useCallback(
    (id: string) => {
      const next = windowsReducer(layoutRef.current, { type: "close", id });
      dispatch({ type: "close", id });
      const front = frontWindow(next);
      navigate(front ? front.route : "/");
    },
    [navigate],
  );

  /** A navigation inside a Window: through the browser, so the URL and the other Windows follow. */
  const navigateFrom = useCallback(
    (id: string, to: string, replace: boolean) => {
      if (frontWindow(layoutRef.current)?.id !== id) dispatch({ type: "focus", id });
      navigate(to, { replace });
    },
    [navigate],
  );

  const act = useCallback((action: WindowAction) => dispatch(action), []);

  return { layout, focus, close, navigateFrom, act, stage: stage ?? fallbackStage };
}
