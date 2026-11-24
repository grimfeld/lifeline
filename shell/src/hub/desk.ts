import {
  dropPagesBehind,
  loadWindowLayout,
  newDesk,
  pathOnly,
  routeTarget,
  windowsReducer,
  type WindowAction,
  type WindowLayout,
} from "@lifeline/core";

/** The desk's own actions on top of the window layout's: loading a Workspace's set. */
export type DeskAction = WindowAction | { type: "load"; layout: WindowLayout };

/** The window layout's reducer, with the desk's rule that a page goes when another Window comes to the front. */
export function deskReducer(layout: WindowLayout, action: DeskAction): WindowLayout {
  if (action.type === "load") return action.layout;
  const next = windowsReducer(layout, action);
  return action.type === "open" || action.type === "focus" ? dropPagesBehind(next) : next;
}

/**
 * The layout a Workspace opens with on this device: its saved one, or a new
 * desk — one maximised Window on the address asked for, or on the last place
 * when the address is `/` (what `/` resolves to).
 */
export function initialLayout(workspaceId: string, asked: string, lastPlace: (workspaceId: string) => string): WindowLayout {
  const saved = loadWindowLayout(workspaceId);
  if (saved) return saved;
  const place = pathOnly(asked) === "/" ? lastPlace(workspaceId) : asked;
  return newDesk(routeTarget(pathOnly(place)).target, place);
}
