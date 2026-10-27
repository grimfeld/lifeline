// PROTOTYPE for #372 — throwaway, never merged.
//
// Which live-preview reveal variant the editor runs: `?variant=A|B|C|D` in the
// URL picks one and remembers it, so in-app navigation (which drops the query)
// keeps it. Without the param ever having been set, the editor is variant A and
// the switcher pill stays hidden.

import { Facet } from "@codemirror/state";

export type Variant = "A" | "B" | "C" | "D";

export const VARIANTS: { id: Variant; name: string }[] = [
  { id: "A", name: "Element" },
  { id: "B", name: "Line" },
  { id: "C", name: "Block" },
  { id: "D", name: "Never" },
];

const KEY = "ll-proto-372-variant";
const SEEN = "ll-proto-372-seen";

const isVariant = (v: unknown): v is Variant => v === "A" || v === "B" || v === "C" || v === "D";

let current: Variant = "A";
let seen = false;
const listeners = new Set<() => void>();

/** Reads the URL param (and remembers it), else what was remembered. Run at load and on every editor mount. */
export function syncVariantFromUrl() {
  let next: Variant = current;
  try {
    const param = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
    if (isVariant(param)) {
      localStorage.setItem(KEY, param);
      localStorage.setItem(SEEN, "1");
    }
    seen = localStorage.getItem(SEEN) === "1" || isVariant(param);
    const stored = isVariant(param) ? param : localStorage.getItem(KEY);
    next = seen && isVariant(stored) ? stored : "A";
  } catch {
    /* private mode: variant A, no pill */
  }
  if (next !== current) {
    current = next;
    listeners.forEach((l) => l());
  }
}
syncVariantFromUrl();

export const getVariant = () => current;
export const pillEnabled = () => seen;

export function setVariant(v: Variant) {
  current = v;
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l());
}

export function cycleVariant(step: 1 | -1) {
  const i = VARIANTS.findIndex((x) => x.id === current);
  setVariant(VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length]!.id);
}

export function subscribeVariant(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The variant inside the editor state (reconfigured through a Compartment when it changes). */
export const variantFacet = Facet.define<Variant, Variant>({ combine: (v) => v[0] ?? "A" });
