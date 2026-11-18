// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * The clip player (ADR 0116), moved down from the e2e suite (#580): a clip
 * plays once as the player appears (a reveal, or a listening Prompt), the
 * button plays it again, and the next Prompt's clip plays afresh.
 */

const clips = [
  { id: "c1", file: "one.wav" },
  { id: "c2", file: "two.wav" },
];
vi.mock("@lifeline/core", () => ({
  useAttachments: () => clips,
  attachmentUrl: async (a: { file: string }) => `blob:${a.file}`,
}));

const { ClipPlayer } = await import("./ClipPlayer");

let plays: string[] = [];
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  plays = [];
  // jsdom has no media playback: record each play and fire the element's play event.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    plays.push(this.getAttribute("src") ?? "");
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function render(node: React.ReactNode) {
  if (!root) root = createRoot(document.body.appendChild(document.createElement("div")));
  await act(async () => root!.render(node));
  // The clip's address resolves a tick later.
  await act(async () => {});
}

const replay = () => document.querySelector<HTMLButtonElement>('[data-testid="clip-replay"]');

describe("ClipPlayer", () => {
  it("plays its clip once as it appears, and again from Replay", async () => {
    await render(<ClipPlayer clipId="c1" />);
    expect(plays).toEqual(["blob:one.wav"]);
    expect(replay()?.disabled).toBe(false);
    expect(replay()?.dataset.plays).toBe("1");

    await act(async () => replay()!.click());
    expect(plays).toEqual(["blob:one.wav", "blob:one.wav"]);
    expect(replay()?.dataset.plays).toBe("2");
  });

  it("plays the next Prompt's clip as it appears too, counting afresh", async () => {
    await render(<ClipPlayer clipId="c1" />);
    await render(<ClipPlayer clipId="c2" />);
    expect(plays).toEqual(["blob:one.wav", "blob:two.wav"]);
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("blob:two.wav");
    expect(replay()?.dataset.plays).toBe("1");
  });

  it("waits to be asked when told not to play at once", async () => {
    await render(<ClipPlayer clipId="c1" autoPlay={false} />);
    expect(plays).toEqual([]);
  });

  it("renders nothing for an item without a clip", async () => {
    await render(<ClipPlayer clipId={undefined} />);
    expect(replay()).toBeNull();
    expect(plays).toEqual([]);
  });
});
