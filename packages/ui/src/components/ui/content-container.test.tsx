// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ContentContainer, isNarrowWidth, NARROW_BELOW, useNarrow } from "./content-container";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogTitle } from "./alert-dialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The viewport's width, as `matchMedia("(max-width: 767px)")` answers it. */
let viewport = 1280;
/** The width every element reports (jsdom lays nothing out). */
let boxWidth = 0;
let observers: ResizeObserverCallback[] = [];

beforeEach(() => {
  window.matchMedia = ((q: string) => ({
    matches: /max-width: 767px/.test(q) && viewport <= 767,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => boxWidth });
  observers = [];
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) {
      observers.push(cb);
    }
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
});

function Probe() {
  return <span data-testid="probe">{useNarrow() ? "narrow" : "wide"}</span>;
}

function render(node: React.ReactNode): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
}

const answer = (host: HTMLElement) => host.querySelector("[data-testid=probe]")!.textContent;

describe("isNarrowWidth", () => {
  it("is narrow below 768px", () => {
    expect(NARROW_BELOW).toBe(768);
    expect(isNarrowWidth(320)).toBe(true);
    expect(isNarrowWidth(767.5)).toBe(true);
    expect(isNarrowWidth(768)).toBe(false);
    expect(isNarrowWidth(1920)).toBe(false);
  });
});

describe("useNarrow", () => {
  it("without a container, follows the page root: the viewport", () => {
    viewport = 1280;
    expect(answer(render(<Probe />))).toBe("wide");
    act(() => root?.unmount());
    viewport = 390;
    expect(answer(render(<Probe />))).toBe("narrow");
  });

  it("in a container, follows the container's width, not the viewport's", () => {
    viewport = 1920;
    boxWidth = 400;
    const host = render(
      <ContentContainer>
        <Probe />
      </ContentContainer>,
    );
    expect(answer(host)).toBe("narrow");
    act(() => observers[0]!([{ contentRect: { width: 900 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(answer(host)).toBe("wide");
  });

  it("a wide container on a phone-sized viewport is wide", () => {
    viewport = 390;
    boxWidth = 1000;
    expect(
      answer(
        render(
          <ContentContainer>
            <Probe />
          </ContentContainer>,
        ),
      ),
    ).toBe("wide");
  });

  it("marks the container as the `content` size container", () => {
    boxWidth = 1000;
    const host = render(<ContentContainer className="flex">x</ContentContainer>);
    const el = host.querySelector("[data-slot=content-container]")!;
    expect(el.className).toContain("content-container");
    expect(el.className).toContain("flex");
  });
});

describe("AlertDialog, portalled into <body>", () => {
  const open = (width: number) => {
    viewport = 1920;
    boxWidth = width;
    render(
      <ContentContainer>
        <AlertDialog open>
          <AlertDialogContent aria-describedby={undefined}>
            <AlertDialogTitle>Delete type</AlertDialogTitle>
            <AlertDialogFooter>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ContentContainer>,
    );
    const content = document.querySelector("[data-slot=alert-dialog-content]")!;
    return { content, footer: content.querySelector("[data-slot=alert-dialog-footer]")!, action: content.querySelector("button")! };
  };

  it("opened from a narrow container, sits at the bottom with thumb-sized buttons", () => {
    const { content, footer, action } = open(400);
    expect(content.className).toContain("bottom-0");
    expect(content.className).not.toContain("max-w-sm");
    expect(footer.className).not.toContain("flex-row");
    expect(action.getAttribute("data-size")).toBe("touch");
  });

  it("opened from a wide container, is the centred desk dialog", () => {
    const { content, footer, action } = open(1000);
    expect(content.className).toContain("max-w-sm");
    expect(content.className).not.toContain("bottom-0");
    expect(footer.className).toContain("flex-row");
    expect(action.getAttribute("data-size")).toBe("default");
  });
});
