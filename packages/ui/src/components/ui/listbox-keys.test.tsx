// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { TimeField } from "./time-field";
import { TagInput } from "./tag-input";

/** The keys and ARIA of the kit's two hand-built listboxes (#290): arrows move a highlight a screen reader hears. */

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

let root: Root | null = null;
afterEach(() => {
  act(() => root?.unmount());
  root = null;
  document.body.innerHTML = "";
});

function render(node: React.ReactNode) {
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  act(() => root!.render(node));
  return document.querySelector<HTMLInputElement>('[role="combobox"]')!;
}

const press = (el: HTMLElement, key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });

/** The option the combobox says is highlighted. */
const highlighted = (input: HTMLElement) => {
  const id = input.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};

function Time({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TimeField value={value} onChange={setValue} locale="en-GB" aria-label="Start" />
      <output>{value}</output>
    </>
  );
}
const stored = () => document.querySelector("output")!.textContent;

describe("TimeField", () => {
  it("steps a quarter hour with the arrows while the list is shut", () => {
    const input = render(<Time initial="09:00" />);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
    press(input, "ArrowUp");
    expect(stored()).toBe("09:15");
    press(input, "ArrowDown");
    press(input, "ArrowDown");
    expect(stored()).toBe("08:45");
  });

  it("opens on the value, moves through the list with the arrows and picks with Enter", () => {
    const input = render(<Time initial="09:10" />);
    press(input, "ArrowDown", { altKey: true });
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const list = document.getElementById(input.getAttribute("aria-controls")!)!;
    expect(list.getAttribute("role")).toBe("listbox");
    expect(highlighted(input)?.dataset.time).toBe("09:00");

    press(input, "ArrowDown");
    press(input, "ArrowDown");
    expect(highlighted(input)?.dataset.time).toBe("09:30");
    expect(highlighted(input)?.getAttribute("role")).toBe("option");
    expect(stored(), "moving through the list leaves the value").toBe("09:10");

    press(input, "ArrowUp");
    press(input, "Enter");
    expect(stored()).toBe("09:15");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  });

  it("stops at the ends of the day and Escape closes without picking", () => {
    const input = render(<Time initial="23:45" />);
    press(input, "ArrowDown", { altKey: true });
    press(input, "ArrowDown");
    expect(highlighted(input)?.dataset.time).toBe("23:45");
    press(input, "Escape");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(stored()).toBe("23:45");
  });
});

function Tags({ suggestions }: { suggestions: string[] }) {
  const [value, setValue] = useState<string[]>([]);
  return (
    <>
      <TagInput value={value} onChange={setValue} suggestions={suggestions} />
      <output>{value.join(",")}</output>
    </>
  );
}

describe("TagInput", () => {
  it("names the highlighted suggestion by id and moves it with the arrows", () => {
    const input = render(<Tags suggestions={["garden", "gym", "work"]} />);
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(input.hasAttribute("aria-controls")).toBe(false);

    press(input, "ArrowDown");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-controls")!)?.getAttribute("role")).toBe("listbox");
    expect(highlighted(input)?.textContent).toBe("#garden");

    press(input, "ArrowDown");
    press(input, "ArrowDown");
    press(input, "ArrowDown");
    expect(highlighted(input)?.textContent, "stops at the last").toBe("#work");
    expect(highlighted(input)?.getAttribute("aria-selected")).toBe("true");

    press(input, "ArrowUp");
    press(input, "Enter");
    expect(stored()).toBe("gym");
    expect(highlighted(input)?.textContent).toBe("#garden");
  });

  it("keeps the highlight on a suggestion that is still listed", () => {
    const input = render(<Tags suggestions={["garden", "gym"]} />);
    press(input, "ArrowDown");
    press(input, "ArrowDown");
    press(input, "Enter");
    expect(stored()).toBe("gym");
    press(input, "ArrowDown");
    expect(highlighted(input)?.textContent).toBe("#garden");
  });
});
