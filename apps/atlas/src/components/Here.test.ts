import { describe, expect, it } from "vitest";
import { readPosition } from "./Here";

const NO_POSITION = "No position to be had right now: type its name instead.";
const OFF = "Location is off for Lifeline: type its name instead.";

/** A Geolocation that answers getCurrentPosition with `act`. */
const geo = (act: (ok: PositionCallback, fail: PositionErrorCallback) => void) => ({ getCurrentPosition: act }) as unknown as Geolocation;

describe("Here reads the position once, and says why when none comes (ADR 0120)", () => {
  it("hands over the coordinates", async () => {
    await expect(readPosition(geo((ok) => ok({ coords: { latitude: 43.3, longitude: 5.4 } } as GeolocationPosition)))).resolves.toEqual({ lat: 43.3, lon: 5.4 });
  });

  it("tells a refusal from no fix", async () => {
    await expect(readPosition(geo((_, fail) => fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError)))).rejects.toThrow(OFF);
    await expect(readPosition(geo((_, fail) => fail({ code: 3, PERMISSION_DENIED: 1 } as GeolocationPositionError)))).rejects.toThrow(NO_POSITION);
  });

  it("says no position, never the raw text, when the browser throws or fails oddly", async () => {
    await expect(readPosition(geo(() => { throw new TypeError("Illegal invocation"); }))).rejects.toThrow(NO_POSITION);
    await expect(readPosition(geo((_, fail) => fail("weird" as unknown as GeolocationPositionError)))).rejects.toThrow(NO_POSITION);
  });
});
