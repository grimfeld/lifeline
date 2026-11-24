// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { WindowRouter } from "./WindowRouter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
afterEach(() => act(() => root?.unmount()));

function Where() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <button type="button" data-testid="where" onClick={() => navigate("/inner/b", { replace: true })}>
      {pathname + search}
    </button>
  );
}

describe("WindowRouter", () => {
  // It cuts react-router's context to nest a Router (UNSAFE_LocationContext):
  // an upgrade that breaks that breaks every Window, and fails here first.
  it("nests under the app's router, shows its own route, and hands navigations back", () => {
    const asked: [string, boolean][] = [];
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() =>
      root!.render(
        <MemoryRouter initialEntries={["/outer"]}>
          <WindowRouter route="/inner/a?x=1" onNavigate={(to, replace) => asked.push([to, replace])}>
            <Where />
          </WindowRouter>
        </MemoryRouter>,
      ),
    );
    const where = host.querySelector<HTMLButtonElement>("[data-testid=where]")!;
    expect(where.textContent).toBe("/inner/a?x=1");
    act(() => where.click());
    expect(asked).toEqual([["/inner/b", true]]);
  });
});
