import { EMPTY_LAYOUT, loadWindowLayout, newDesk, pathOnly, routeTarget, windowsReducer, type WindowAction, type WindowLayout } from "@lifeline/core";

/** Whether an address opens as a full-screen page over the Hub (#663) rather than in a Window. `/` is the desk itself. */
export function isPageRoute(route: string): boolean {
  const path = pathOnly(route);
  return path !== "/" && routeTarget(path).kind === "page";
}

/** The desk's own actions on top of the window layout's: loading a Workspace's set. */
export type DeskAction = WindowAction | { type: "load"; layout: WindowLayout };

export function deskReducer(layout: WindowLayout, action: DeskAction): WindowLayout {
  return action.type === "load" ? action.layout : windowsReducer(layout, action);
}

/**
 * The layout a Workspace opens with on this device: its saved one, or a new
 * desk — one maximised Window on the address asked for, or on the last place
 * when the address is `/` or a full-screen page (which opens over the desk,
 * never in a Window: #663). Nothing is open when the last place is a page too.
 */
export function initialLayout(workspaceId: string, asked: string, lastPlace: (workspaceId: string) => string): WindowLayout {
  const saved = loadWindowLayout(workspaceId);
  if (saved) return saved;
  const inWindow = (route: string) => pathOnly(route) !== "/" && !isPageRoute(route);
  const place = inWindow(asked) ? asked : lastPlace(workspaceId);
  if (!inWindow(place)) return EMPTY_LAYOUT;
  return newDesk(routeTarget(pathOnly(place)).target, place);
}
