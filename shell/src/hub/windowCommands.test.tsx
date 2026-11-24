// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LEFT_HALF, RIGHT_HALF, type CommandDef, type WindowState } from "@lifeline/core";
import { setDeskControls, useWindowCommands } from "./windowCommands";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  setDeskControls(null);
});

/** The Window Commands as a component sees them, re-read on every render. */
function mount() {
  const seen: { commands: CommandDef[] } = { commands: [] };
  function Probe() {
    seen.commands = useWindowCommands();
    return null;
  }
  root = createRoot(document.createElement("div"));
  act(() => root!.render(<Probe />));
  return seen;
}

const front: WindowState = { id: "map:1", target: "map", route: "/map", box: { x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, mode: "normal" };
const byTitle = (cs: CommandDef[], title: string) => cs.find((c) => c.title === title)!;

describe("the Window Commands", () => {
  it("are five, none offered with no Window open (or no Hub), all offered with one", () => {
    const seen = mount();
    expect(seen.commands).toHaveLength(5);
    expect(seen.commands.every((c) => c.unavailable)).toBe(true);
    act(() => setDeskControls({ front: undefined, act: vi.fn(), close: vi.fn() }));
    expect(seen.commands.every((c) => c.unavailable)).toBe(true);
    act(() => setDeskControls({ front, act: vi.fn(), close: vi.fn() }));
    expect(seen.commands.some((c) => c.unavailable)).toBe(false);
  });

  it("act on the front Window as it is when they run, and go nowhere", () => {
    const seen = mount();
    const desk = { front, act: vi.fn(), close: vi.fn() };
    act(() => setDeskControls(desk));
    const run = (title: string) => byTitle(seen.commands, title).run!({ navigate: vi.fn() });
    run("Snap Window left");
    run("Snap Window right");
    run("Maximise or restore Window");
    run("Full screen Window");
    expect(desk.act.mock.calls.map(([a]) => a)).toEqual([
      { type: "snap", id: "map:1", box: LEFT_HALF },
      { type: "snap", id: "map:1", box: RIGHT_HALF },
      { type: "maximise", id: "map:1" },
      { type: "fullScreen", id: "map:1" },
    ]);
    // Another Window comes to the front: the next run acts on it.
    act(() => setDeskControls({ ...desk, front: { ...front, id: "graph:1", target: "graph" } }));
    run("Close Window");
    expect(desk.close).toHaveBeenCalledWith("graph:1");
    expect(seen.commands.every((c) => c.navigates === false)).toBe(true);
  });

  it("do nothing once the last Window has gone", () => {
    const seen = mount();
    const desk = { front, act: vi.fn(), close: vi.fn() };
    act(() => setDeskControls(desk));
    const close = byTitle(seen.commands, "Close Window");
    act(() => setDeskControls({ ...desk, front: undefined }));
    close.run!({ navigate: vi.fn() });
    expect(desk.close).not.toHaveBeenCalled();
  });
});
