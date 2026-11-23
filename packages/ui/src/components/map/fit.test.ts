import { describe, expect, it } from "vitest";
import { planView, type FitState } from "./fit";
import type { MapPin } from "./tiles";

const pin = (key: string, lat: number, lon: number): MapPin => ({ key, name: key, lat, lon });
const fresh: FitState = { fitted: false, focused: undefined };

describe("planView", () => {
  it("stays on the world view while there are no pins", () => {
    expect(planView([], undefined, fresh, 2)).toEqual({ action: "none", state: fresh });
  });

  it("centres a single pin at zoom 13, and fits several", () => {
    expect(planView([pin("a", 1, 2)], undefined, fresh, 2)).toEqual({ action: "centre", at: [1, 2], zoom: 13, state: { fitted: true, focused: undefined } });
    const two = [pin("a", 1, 2), pin("b", 3, 4)];
    expect(planView(two, undefined, fresh, 2).action).toBe("fit");
  });

  it("never moves again once fitted, whatever the pins do", () => {
    const state: FitState = { fitted: true, focused: undefined };
    expect(planView([pin("c", 9, 9)], undefined, state, 7).action).toBe("none");
    expect(planView([], undefined, state, 7).action).toBe("none");
  });

  it("fits when the first pins arrive on a map that began empty, once", () => {
    const first = planView([], undefined, fresh, 2);
    const arrived = planView([pin("a", 1, 2)], undefined, first.state, 2);
    expect(arrived.action).toBe("centre");
    expect(planView([pin("a", 1, 2), pin("b", 3, 4)], undefined, arrived.state, 13).action).toBe("none");
  });

  it("centres on a focused pin at max(zoom, 15), and counts as fitted", () => {
    const plan = planView([pin("a", 1, 2), pin("b", 3, 4)], "b", fresh, 4);
    expect(plan).toEqual({ action: "centre", at: [3, 4], zoom: 15, state: { fitted: true, focused: "b" } });
    expect(planView([pin("b", 3, 4)], "b", plan.state, 17).action).toBe("none");
  });

  it("centres when the focus changes to another pin", () => {
    const state: FitState = { fitted: true, focused: "a" };
    expect(planView([pin("a", 1, 2), pin("b", 3, 4)], "b", state, 17)).toEqual({ action: "centre", at: [3, 4], zoom: 17, state: { fitted: true, focused: "b" } });
  });

  it("waits for a focused pin that has not arrived, without fitting past it", () => {
    expect(planView([pin("a", 1, 2)], "b", fresh, 2).action).toBe("none");
  });
});
