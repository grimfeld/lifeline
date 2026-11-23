import type { MapPin } from "./tiles";

/** What a map has already done to its view: fitted its pins once, centred on a focus. */
export interface FitState {
  fitted: boolean;
  /** The focus key last centred on. */
  focused: string | undefined;
}

export type ViewPlan =
  | { action: "none"; state: FitState }
  | { action: "centre"; at: [number, number]; zoom: number; state: FitState }
  | { action: "fit"; state: FitState };

/**
 * What a map should do to its view now (ADR 0135): fit its pins the first time it
 * has any, then never again; a focus still centres on its pin. A person's pan and
 * zoom are never undone by a change in the pins.
 */
export function planView(pins: MapPin[], focus: string | undefined, state: FitState, zoom: number): ViewPlan {
  if (focus && focus !== state.focused) {
    const target = pins.find((p) => p.key === focus);
    if (target) return { action: "centre", at: [target.lat, target.lon], zoom: Math.max(zoom, 15), state: { fitted: true, focused: focus } };
    return { action: "none", state }; // the focused pin has not arrived: wait for it, do not fit past it
  }
  if (state.fitted || pins.length === 0) return { action: "none", state };
  const next = { ...state, fitted: true };
  if (pins.length === 1) return { action: "centre", at: [pins[0]!.lat, pins[0]!.lon], zoom: 13, state: next };
  return { action: "fit", state: next };
}
