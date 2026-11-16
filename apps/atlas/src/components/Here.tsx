import { useState } from "react";
import { errorMessage, placesNearby, type Coords } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { Loader2, LocateFixed, MapPin, Navigation } from "lucide-react";
import { Candidate, CandidateList } from "./CandidateList";
import { toHit, type PlaceHit } from "./PlaceLookup";

/** Whether this browser can give a position at all: without it, Here is not offered (#501). */
export const canLocateHere = () => typeof navigator !== "undefined" && !!navigator.geolocation;

/** Why no position came: a refusal, or none to be had (no fix, too slow, or a browser that threw). */
function noPositionMessage(e: unknown): string {
  const PERMISSION_DENIED = 1; // GeolocationPositionError.PERMISSION_DENIED, read as a number: the global may not exist.
  return (e as GeolocationPositionError | undefined)?.code === PERMISSION_DENIED ? "Location is off for Lifeline: type its name instead." : "No position to be had right now: type its name instead.";
}

/**
 * The device's position, read once (ADR 0120): never watched, never cached by
 * the browser for us. Whatever goes wrong, it rejects with one of
 * `noPositionMessage`'s sentences, never the browser's own text.
 */
export function readPosition(geo: Geolocation = navigator.geolocation): Promise<Coords> {
  return new Promise((resolve, reject) => {
    const fail = (e: unknown) => reject(new Error(noPositionMessage(e)));
    try {
      geo.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }), fail, { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
    } catch (e) {
      fail(e);
    }
  });
}

/**
 * Here (#501, ADR 0119, ADR 0120): on tap, the device's position is read once
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
      const hits = await placesNearby(at).catch(() => undefined);
      setFound({ at, hits: hits?.map(toHit) ?? [], failed: !hits });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const caption = !found ? "" : found.failed ? "The places around you couldn’t be found: use Just here, or type its name." : found.hits.length === 0 ? "No place known around you: use Just here, or type its name." : "Which one are you in?";

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
      <CandidateList label="Places here" caption={caption}>
        {found?.hits.map((h, i) => (
          <Candidate
            key={i}
            onPick={() => {
              setFound(undefined);
              onPick(h);
            }}
          >
            <MapPin className="shrink-0" />
            <span className="grid min-w-0">
              <span className="min-w-0 font-medium break-words">{h.name}</span>
              <span className="text-muted-foreground min-w-0 text-xs break-words">{h.address}</span>
            </span>
          </Candidate>
        ))}
        {found && (
          <Candidate
            className="items-center"
            onPick={() => {
              const at = found.at;
              setFound(undefined);
              onJustHere(at);
            }}
          >
            <LocateFixed /> Just here
          </Candidate>
        )}
      </CandidateList>
    </div>
  );
}
