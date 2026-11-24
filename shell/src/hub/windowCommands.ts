import { useSyncExternalStore } from "react";
import { LEFT_HALF, RIGHT_HALF, type CommandDef, type WindowAction, type WindowState } from "@lifeline/core";
import { Expand, Maximize2, PanelLeft, PanelRight, X } from "lucide-react";

/** What the Window Commands act through: the Hub's front Window and its desk. Null with no Hub (the phone). */
export interface DeskControls {
  front: WindowState | undefined;
  act: (action: WindowAction) => void;
  close: (id: string) => void;
}

let controls: DeskControls | null = null;
const listeners = new Set<() => void>();

/** The Hub hands over its desk while it is mounted, and null when it goes. */
export function setDeskControls(next: DeskControls | null) {
  controls = next;
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const hasFront = () => !!controls?.front;

/** Run on the front Window as it is when the Command runs, if there is one. */
const onFront = (f: (c: DeskControls, front: WindowState) => void) => () => {
  if (controls?.front) f(controls, controls.front);
};

const WINDOW_COMMANDS: Omit<CommandDef, "unavailable">[] = [
  {
    id: "hub.window-snap-left",
    title: "Snap Window left",
    keywords: ["window", "half", "tile", "left"],
    icon: PanelLeft,
    navigates: false,
    run: onFront((c, w) => c.act({ type: "snap", id: w.id, box: LEFT_HALF })),
  },
  {
    id: "hub.window-snap-right",
    title: "Snap Window right",
    keywords: ["window", "half", "tile", "right"],
    icon: PanelRight,
    navigates: false,
    run: onFront((c, w) => c.act({ type: "snap", id: w.id, box: RIGHT_HALF })),
  },
  {
    id: "hub.window-maximise",
    title: "Maximise or restore Window",
    keywords: ["window", "maximize", "restore", "fill", "stage"],
    icon: Maximize2,
    navigates: false,
    run: onFront((c, w) => c.act({ type: "maximise", id: w.id })),
  },
  {
    id: "hub.window-full-screen",
    title: "Full screen Window",
    keywords: ["window", "fullscreen", "focus", "hide", "hub", "zen"],
    icon: Expand,
    navigates: false,
    run: onFront((c, w) => c.act({ type: "fullScreen", id: w.id })),
  },
  {
    id: "hub.window-close",
    title: "Close Window",
    keywords: ["window", "close"],
    icon: X,
    navigates: false,
    run: onFront((c, w) => c.close(w.id)),
  },
];

/**
 * The five Window Commands (#663): each acts on the front Window, and is
 * bindable in Settings › Keys. With no Window open — or no Hub, on the phone —
 * they are not offered in the palette, though Keys still lists them.
 */
export function useWindowCommands(): CommandDef[] {
  const offered = useSyncExternalStore(subscribe, hasFront, () => false);
  return offered ? WINDOW_COMMANDS : WINDOW_COMMANDS.map((c) => ({ ...c, unavailable: true }));
}

/** The Window Commands' titles, for the Guide's check. */
export const WINDOW_COMMAND_TITLES = WINDOW_COMMANDS.map((c) => c.title);
