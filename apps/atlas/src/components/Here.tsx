import { useState } from "react";
import { placesNearby, type Coords } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { Loader2, LocateFixed, MapPin, Navigation } from "lucide-react";
import type { PlaceHit } from "./PlaceLookup";


/** Whether this browser can give a position at all: without it, Here is not offered (#501). */
export const canLocateHere = () => typeof navigator !== "undefined" && !!navigator.geolocation;

/** Why no position came: a refusal, or none to be had (no fix, or too slow). */
function noPositionMessage(e: GeolocationPositionError): string {
  return e.code === e.PERMISSION_DENIED ? "Location is off for Lifeline: type its name instead." : "No position to be had right now: type its name instead.";
}

/** The device's position, read once (ADR 0120): never watched, never cached by the browser for us. */
function readPosition(): Promise<Coords> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new Error(noPositionMessage(e))),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    ),
  );
}

/**
 * Here (#501, ADR 0128, ADR 0120): on tap, the device's position is read once
 * and Photon offers the places around it. A pick hands over the place's name,
 * address and coordinates; Just here hands over the position itself, for the
 * name typed. The position lives in this panel's state only, until a pick or
 * the form closes: it is never stored or logged.
 */
export function HereButton({ onPick, onJustHere }: { onPick: (hit: PlaceHit) => void; onJustHere: (at: Coords) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState<{ at: Coords; hits: PlaceHit[]; failed: boolean }>();

  if (!canLocateHere()) return null;

  async function locate() {
    setBusy(true);
    setError("");
    setFound(undefined);
    try {
      const at = await readPosition();
      try {
        const hits = await placesNearby(at);
        setFound({ at, hits: hits.map((h) => ({ name: h.name, address: h.label, at: { lat: h.lat, lon: h.lon } })), failed: false });
      } catch {
        setFound({ at, hits: [], failed: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No position to be had right now: type its name instead.");
    } finally {
      setBusy(false);
    }
  }

  function done() {
    setFound(undefined);
  }

  return (
    <div className="grid min-w-0 gap-1">
      <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={busy} onClick={() => void locate()}>
        {busy ? <Loader2 className="animate-spin" /> : <Navigation />} Here
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      {found && (
        <div className="grid min-w-0 gap-0.5 rounded-md border p-1" role="group" aria-label="Places here">
          <p className="text-muted-foreground px-1 text-xs">
            {found.failed ? "The places around you couldn’t be found: use Just here, or type its name." : found.hits.length === 0 ? "No place known around you: use Just here, or type its name." : "Which one are you in?"}
          </p>
          {found.hits.map((h, i) => (
            <Button
              key={i}
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto min-w-0 justify-start py-1 text-left font-normal whitespace-normal"
              onClick={() => {
                done();
                onPick(h);
              }}
            >
              <MapPin className="shrink-0" />
              <span className="grid min-w-0">
                <span className="min-w-0 font-medium break-words">{h.name}</span>
                <span className="text-muted-foreground min-w-0 text-xs break-words">{h.address}</span>
              </span>
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => {
              const at = found.at;
              done();
              onJustHere(at);
            }}
          >
            <LocateFixed /> Just here
          </Button>
        </div>
      )}
    </div>
  );
}
