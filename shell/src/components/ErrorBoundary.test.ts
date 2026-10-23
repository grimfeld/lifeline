// @vitest-environment jsdom
import { createElement as h, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardBoundary } from "./ErrorBoundary";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host, { onCaughtError: () => {} });
  // React reports a caught render error on the console in development; the test expects it.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

function Fine({ name }: { name: string }) {
  return h("p", null, `${name} works`);
}

let broken = true;
function Broken() {
  if (broken) throw new Error("this Card is broken");
  return h("p", null, "Broken works");
}

function grid(resetKey = "a") {
  return h(
    "div",
    null,
    h(CardBoundary, { resetKey: "one", children: h(Fine, { name: "One" }) }),
    h(CardBoundary, { resetKey, children: h(Broken) }),
    h(CardBoundary, { resetKey: "three", children: h(Fine, { name: "Three" }) }),
  );
}

describe("CardBoundary", () => {
  it("shows a throwing Card's error state while the other Cards render", () => {
    broken = true;
    act(() => root.render(grid()));
    expect(host.textContent).toContain("One works");
    expect(host.textContent).toContain("Three works");
    const alerts = host.querySelectorAll('[role="alert"]');
    expect(alerts).toHaveLength(1);
    expect(alerts[0].textContent).toContain("This card couldn't load.");
  });

  it("tries the Card again on Try again, and when its settings change", () => {
    broken = true;
    act(() => root.render(grid("a")));
    broken = false;
    act(() => host.querySelector<HTMLButtonElement>('[role="alert"] button')!.click());
    expect(host.textContent).toContain("Broken works");

    broken = true;
    act(() => root.render(grid("b")));
    expect(host.querySelectorAll('[role="alert"]')).toHaveLength(1);
    broken = false;
    act(() => root.render(grid("c")));
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.textContent).toContain("Broken works");
  });
});
