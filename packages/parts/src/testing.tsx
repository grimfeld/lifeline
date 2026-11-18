import { afterEach, beforeAll } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { documentsTable, getDocument, initApps, peekPartOf, putDocument, useDocument, useDocumentType, type AppManifest, type Document } from "@lifeline/core";
import { PEEK_WRITE_DELAY } from "./components/WorkPeekFields";

/**
 * An App's Peek part under test (#574): rendered in jsdom against the real
 * Core (its store on fake IndexedDB, which the test file imports first), live
 * as the Peek frame renders it — it re-renders on every save. A one-field
 * edit is checked here, not in e2e: find the control by its label, edit it as
 * a person would, then read what was stored once the Peek's write delay is out.
 *
 * A test file opens with `// @vitest-environment jsdom` and
 * `import "fake-indexeddb/auto"`, then calls `peekTests([theApp])`.
 */
export function peekTests(apps: AppManifest[]): void {
  initApps(apps);
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    // What Radix's menus, selects and popovers ask of a browser jsdom is not.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
    // A desktop-wide window: no media query matches.
    window.matchMedia ??= (query: string) => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
  });
  afterEach(async () => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    await documentsTable().clear();
  });
}

let root: Root | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function LivePeek({ id }: { id: string }) {
  const doc = useDocument(id);
  const part = peekPartOf(useDocumentType(doc?.type));
  return doc && part ? <part.Part doc={doc} /> : null;
}

/** Put the Documents in order (a later one may name an earlier one's id as `$0`, `$1`…), peek the last, and return their ids. */
export async function peekNew(...docs: (Partial<Document> & { type: string } & Record<string, unknown>)[]): Promise<string[]> {
  const ids: string[] = [];
  for (const d of docs) {
    const filled = Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "string" && /^\$\d+$/.test(v) ? ids[Number(v.slice(1))] : v]));
    ids.push((await putDocument({ title: "", body: "", ...filled } as Partial<Document> & { type: string })).id);
  }
  await peek(ids[ids.length - 1]!);
  return ids;
}

/** Show this Document's Peek part (in place of any shown before), once it has drawn. */
export async function peek(id: string): Promise<void> {
  act(() => root?.unmount());
  document.body.innerHTML = "";
  root = createRoot(document.body.appendChild(document.createElement("div")));
  act(() =>
    root!.render(
      // The Peek frame sits inside the shell's router: a part may link.
      <MemoryRouter>
        <LivePeek id={id} />
      </MemoryRouter>,
    ),
  );
  for (let i = 0; i < 100 && !document.body.firstElementChild?.hasChildNodes(); i++) await settle(10);
  if (!document.body.firstElementChild?.hasChildNodes()) throw new Error(`The Peek of ${id} drew nothing`);
}

/** Let the store answer and React draw. */
export const settle = (ms = 20) => act(() => sleep(ms));

/** The Field `key` of Document `id` as stored, once the Peek's write delay is out. */
export async function stored(id: string, key: string): Promise<unknown> {
  await settle(PEEK_WRITE_DELAY + 150);
  return (await getDocument(id))?.[key];
}

/** What a screen reader names `el`: its aria-label, what labels it, else its text. */
function nameOf(el: HTMLElement): string {
  const by = el.getAttribute("aria-labelledby");
  const labels = "labels" in el ? [...((el as HTMLInputElement).labels ?? [])] : [];
  const name =
    el.getAttribute("aria-label") ??
    (by ? by.split(" ").map((i) => document.getElementById(i)?.textContent ?? "").join(" ") : labels.length ? labels.map((l) => l.textContent).join(" ") : el.textContent);
  return (name ?? "").replace(/\s+/g, " ").trim();
}

/** Every control named `name` (exactly, or matching), of `role` when given. */
function controls(name: string | RegExp, role?: string): HTMLElement[] {
  const selector = role ? (role === "button" ? `button, [role="button"]` : `[role="${role}"]`) : `input, textarea, select, button, [role]`;
  return [...document.querySelectorAll<HTMLElement>(selector)].filter((el) => (typeof name === "string" ? nameOf(el) === name : name.test(nameOf(el))));
}

/** The one control named `name` (exactly, or matching), of `role` when given; throws when none or several. */
export function control(name: string | RegExp, role?: string): HTMLElement {
  const hits = controls(name, role);
  if (hits.length !== 1) throw new Error(`${hits.length} controls named ${String(name)}${role ? ` (${role})` : ""}`);
  return hits[0]!;
}

/** Whether any control named `name` is drawn (a guarded Field has none). */
export const has = (name: string | RegExp, role?: string): boolean => controls(name, role).length > 0;

/** Type `text` into the field named `name`, over what it holds. */
export async function fill(name: string, text: string): Promise<void> {
  const el = control(name) as HTMLInputElement | HTMLTextAreaElement;
  act(() => {
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await settle();
}

/** Leave the field named `name`. */
export async function leave(name: string): Promise<void> {
  const el = control(name);
  act(() => el.blur());
  await settle();
}

/** Press `key` in the control named `name`. */
export async function press(name: string, key: string): Promise<void> {
  const el = control(name);
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
  await settle();
}

/** Click `el`, as a mouse does: pointer down and up, then click. */
export async function click(el: HTMLElement): Promise<void> {
  act(() => {
    const init = { bubbles: true, cancelable: true, button: 0, pointerType: "mouse" };
    const Pointer = globalThis.PointerEvent ?? MouseEvent;
    el.dispatchEvent(new Pointer("pointerdown", init));
    el.dispatchEvent(new Pointer("pointerup", init));
    el.click();
  });
  await settle();
}

/** Open the combobox named `name` and pick its option `option`. */
export async function choose(name: string, option: string | RegExp): Promise<void> {
  await click(control(name, "combobox"));
  await click(control(option, "option"));
}
