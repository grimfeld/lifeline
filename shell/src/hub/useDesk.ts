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

function deskReducer(layout: WindowLayout, action: DeskAction): WindowLayout {
  return action.type === "load" ? action.layout : windowsReducer(layout, action);
}

/** The layout a Workspace opens with on this device: its saved one, or a new desk on the last place. */
function initialLayout(workspaceId: string): WindowLayout {
  const saved = loadWindowLayout(workspaceId);
  if (saved) return saved;
  const place = lastPlace(workspaceId);
  return newDesk(routeTarget(place).target, place);
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
  const [layout, dispatch] = useReducer(deskReducer, workspaceId, initialLayout);
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
    const next = initialLayout(workspaceId);
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
    const targets = [...modules, ...SURFACES.map((s) => s.id), "screens"];
    dispatch({ type: "prune", targets: [...targets, ...layout.windows.filter((w) => w.target.startsWith("page:")).map((w) => w.target)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a change of the Workspace's Modules only
  }, [moduleKey]);

  // The URL drives the front Window.
  const path = fullPath(location);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
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
