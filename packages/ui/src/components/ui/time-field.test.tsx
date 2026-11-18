// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeField } from "./time-field";
import { Dialog, DialogContent, DialogTitle } from "./dialog";

const noop = () => {};

describe("TimeField", () => {
  it("shows the stored time in the locale's clock", () => {
    expect(renderToStaticMarkup(<TimeField value="21:30" onChange={noop} locale="en-GB" />)).toContain('value="21:30"');
    expect(renderToStaticMarkup(<TimeField value="21:30" onChange={noop} locale="en-US" />)).toContain('value="9:30 PM"');
  });

  it("is a combobox carrying the field's id, name, description, invalid state and disabled", () => {
    const html = renderToStaticMarkup(
      <TimeField id="start" value="" onChange={noop} aria-label="Start" aria-describedby="start-hint" aria-invalid disabled />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('id="start"');
    expect(html).toContain('aria-label="Start"');
    expect(html).toContain('aria-describedby="start-hint"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toMatch(/<input[^>]* disabled=""/);
  });
});

/* Typing, the arrows and the list, as a person uses them (moved down from the e2e time-field spec, #571). */

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

function Time({ initial, inDialog = false }: { initial: string; inDialog?: boolean }) {
  const [value, setValue] = useState(initial);
  const [open, setOpen] = useState(true);
  const field = (
    <>
      <TimeField value={value} onChange={setValue} locale="en-GB" aria-label="End" />
      <output>{value}</output>
    </>
  );
  if (!inDialog) return field;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Edit time blocker</DialogTitle>
        {field}
      </DialogContent>
    </Dialog>
  );
}

function render(node: React.ReactNode) {
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  act(() => root!.render(node));
  return document.querySelector<HTMLInputElement>('[role="combobox"]')!;
}

const stored = () => document.querySelector("output")?.textContent;

/** Type `text` into the field as a person does: the input event React reads, then Enter. */
function type(input: HTMLInputElement, text: string) {
  act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    set.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
}

const press = (el: HTMLElement, key: string) =>
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });

/** A press on an element, the way a pointer makes one: pointerdown (jsdom has no PointerEvent), mousedown, then click. */
const tap = (el: Element) =>
  act(() => {
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });

describe("TimeField typing, arrows and list", () => {
  it("reads a typed time", () => {
    const input = render(<Time initial="17:00" />);
    type(input, "930");
    expect(stored()).toBe("09:30");
    expect(input.value).toBe("09:30");
  });

  it("reverts text that isn't a time to the time it held", () => {
    const input = render(<Time initial="17:00" />);
    type(input, "lunchtime");
    expect(stored()).toBe("17:00");
    expect(input.value).toBe("17:00");
  });

  it("steps a quarter hour with each arrow", () => {
    const input = render(<Time initial="17:00" />);
    press(input, "ArrowUp");
    press(input, "ArrowUp");
    expect(stored()).toBe("17:30");
    press(input, "ArrowDown");
    expect(stored()).toBe("17:15");
  });

  it("opens the list on a click, the time held selected, and a picked row becomes the time and closes the list", () => {
    const input = render(<Time initial="17:00" />);
    act(() => input.click());
    const list = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Times"]')!;
    expect(list).not.toBeNull();
    expect(list.querySelector('[role="option"][aria-selected="true"]')?.getAttribute("data-time")).toBe("17:00");

    tap(list.querySelector('[data-time="18:45"]')!);
    expect(stored()).toBe("18:45");
    expect(input.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it("picking from the list leaves the Dialog it sits in open", async () => {
    const input = render(<Time initial="17:00" inDialog />);
    // The Dialog starts listening for presses outside it a tick after it opens.
    const tick = () => act(() => new Promise((r) => setTimeout(r, 0)));
    await tick();
    act(() => input.click());
    await tick();
    tap(document.querySelector('[role="listbox"] [data-time="18:45"]')!);
    expect(stored()).toBe("18:45");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    // A press outside both does close it: the check above can fail.
    tap(document.body.appendChild(document.createElement("div")));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
