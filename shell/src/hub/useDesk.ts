import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router";
import {
  DESK_SURFACES,
  frontWindow,
  isPageTarget,
  loadWindowLayout,
  recordRoute,
  routeTarget,
  saveWindowLayout,
  stepRoute,
  useCurrentWorkspaceId,
  useWorkspaceModules,
  windowsReducer,
  type Stage,
  type WindowAction,
  type WindowHistory,
} from "@lifeline/core";
import { lastPlace } from "../nav/resume";
import { deskReducer, initialLayout } from "./desk";

/** The full path of a location: what a Window's route holds. */
const fullPath = (l: { pathname: string; search: string; hash: string }) => l.pathname + l.search + l.hash;

/** The stage before it is first measured. */
const FALLBACK_STAGE: Stage = { width: 1280, height: 720 };

/** react-router's position of the current entry in the browser's history, when it set one. */
const historyIndex = (): number | null => {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" ? idx : null;
};

/**
 * The desk's state (ADR 0133): the window layout of the current Workspace,
 * saved on this device, and kept in step with the browser's URL.
 *
 * The URL is the front Window's route. Every navigation — inside a Window, from
 * the palette, a Peek, a Card, a typed URL — goes through the browser; when the
 * URL changes, the Window its route belongs to opens there, or comes to the
 * front on it. Focusing or closing a Window replaces the URL and adds no entry,
 * and each Window keeps its own history in memory: Back and Forward step the
 * front Window through its own, and only when it has nowhere to go that way
 * does the browser's earlier address take over.
 */
export function useDesk(stage: Stage | null) {
  const workspaceId = useCurrentWorkspaceId();
  const modules = useWorkspaceModules();
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const [layout, dispatch] = useReducer(deskReducer, workspaceId, (id) => initialLayout(id, fullPath(window.location), lastPlace));
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  /** Each Window's history, by target (one Window per target for now). */
  const histories = useRef(new Map<string, WindowHistory>());
  const lastIndex = useRef<number | null>(historyIndex());

  // Each Workspace keeps its own Windows: switching swaps the set.
  const loadedFor = useRef(workspaceId);
  useEffect(() => {
    if (loadedFor.current === workspaceId) return;
    const first = loadedFor.current === "";
    loadedFor.current = workspaceId;
    // The Workspace becomes known after the first paint (the first pull): the
    // desk on screen is already this Workspace's, so it is adopted, not replaced.
    if (first && !loadWindowLayout(workspaceId)) return;
    let next = initialLayout(workspaceId, "/", lastPlace);
    // A page in front (a Handoff choosing its Workspace) stays where it is, in front of the new set.
    const page = frontWindow(layoutRef.current);
    if (page && isPageTarget(page.target)) next = { ...next, windows: [...next.windows.filter((w) => w.target !== page.target), page] };
    histories.current.clear();
    dispatch({ type: "load", layout: next });
    const front = frontWindow(next);
    navigate(front ? front.route : "/", { replace: true });
  }, [workspaceId, navigate]);

  // Saved on every change, per device and per Workspace.
  useEffect(() => {
    if (loadedFor.current === workspaceId) saveWindowLayout(workspaceId, layout);
  }, [layout, workspaceId]);

  // A Window whose Module the Workspace no longer takes is dropped. An empty
  // list is a Workspace not loaded yet, never one that took every Module away.
  const moduleKey = modules.join(",");
  useEffect(() => {
    if (moduleKey === "") return;
    dispatch({ type: "prune", targets: [...moduleKey.split(","), ...DESK_SURFACES.map((s) => s.id)] });
  }, [moduleKey]);

  // The URL drives the front Window.
  const path = fullPath(location);
  useEffect(() => {
    const index = historyIndex();
    const previous = lastIndex.current;
    lastIndex.current = index;
    const front = frontWindow(layoutRef.current);
    if (location.pathname === "/") {
      // `/` is "the desk as it was": the front Window's route, or the empty stage.
      if (front) navigate(front.route, { replace: true });
      return;
    }
    // Back or Forward: the front Window steps through its own history.
    if (navigationType === "POP" && front && index !== null && previous !== null && index !== previous) {
      const step = stepRoute(histories.current.get(front.target), index - previous);
      if (step) {
        histories.current.set(front.target, step.history);
        if (step.route !== path) {
          dispatch({ type: "route", id: front.id, route: step.route });
          navigate(step.route, { replace: true });
        }
        return;
      }
    }
    if (front && front.route === path) {
      histories.current.set(front.target, recordRoute(histories.current.get(front.target), path, true));
      return;
    }
    const { target } = routeTarget(location.pathname);
    histories.current.set(target, recordRoute(histories.current.get(target), path, navigationType === "REPLACE"));
    dispatch({ type: "open", target, route: path, stage: stageRef.current ?? FALLBACK_STAGE });
    // Keyed on the address alone: the layout and the navigation type are read as they stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [path]);

  /** Bring a Window to the front, its route into the URL (no new history entry). */
  const focus = useCallback(
    (id: string) => {
      const win = layoutRef.current.windows.find((w) => w.id === id);
      if (!win || frontWindow(layoutRef.current)?.id === id) return;
      dispatch({ type: "focus", id });
      navigate(win.route, { replace: true });
    },
    [navigate],
  );

  /** Close a Window; the one behind it comes to the front, or the stage empties. */
  const close = useCallback(
    (id: string) => {
      const current = layoutRef.current;
      const win = current.windows.find((w) => w.id === id);
      if (!win) return;
      // Worked out here as well as in the dispatch: to know whose route the URL shows next.
      const front = frontWindow(windowsReducer(current, { type: "close", id }));
      histories.current.delete(win.target);
      dispatch({ type: "close", id });
      navigate(front ? front.route : "/", { replace: true });
    },
    [navigate],
  );

  /** A navigation inside a Window: through the browser, so the URL and the other Windows follow. */
  const navigateFrom = useCallback(
    (id: string, to: string, replace: boolean) => {
      if (frontWindow(layoutRef.current)?.id !== id) {
        dispatch({ type: "focus", id });
        // To the address already shown, the URL does not change: the Window takes the route itself.
        if (to === fullPath(window.location)) dispatch({ type: "route", id, route: to });
      }
      navigate(to, { replace });
    },
    [navigate],
  );

  const act = useCallback((action: WindowAction) => dispatch(action), []);

  return { layout, focus, close, navigateFrom, act };
}
