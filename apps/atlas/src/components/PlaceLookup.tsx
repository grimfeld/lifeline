import { useState } from "react";
import { geocode, suggestAddresses, type Coords, type GeocodeHit } from "@lifeline/core";
import { Button, Combobox, Field, type ComboboxOption } from "@lifeline/ui";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";

/** A real place the typeahead found (Photon): one pick gives its name, its address and its coordinates. */
export interface PlaceHit {
  name?: string;
  address: string;
  at: Coords;
}

interface HitOption extends ComboboxOption {
  hit: PlaceHit;
}

const toHit = (h: GeocodeHit): PlaceHit => ({ name: h.name, address: h.label, at: { lat: h.lat, lon: h.lon } });

/** The typeahead's search (ADR 0011): Photon, as the user types, never on render. A point of interest leads with its name. */
async function searchPlaces(query: string): Promise<HitOption[]> {
  const hits = await suggestAddresses(query);
  return hits.map((h, i) => ({ value: `${i}:${h.lat},${h.lon}`, label: h.name ?? h.label, description: h.name ? h.label : undefined, hit: toHit(h) }));
}

const search = (q: string) => searchPlaces(q).catch(() => []);

/**
 * A text field that offers matching real places as you type (#487 story 2):
 * the Place's name or its address. The text stays as typed until a pick,
 * which hands over the whole hit.
 */
export function PlaceSearchField({
  label,
  value,
  onChange,
  onPick,
  placeholder,
  autoFocus,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  onPick: (hit: PlaceHit) => void;
  placeholder?: string;
  autoFocus?: boolean;
  error?: string;
  hint?: string;
}) {
  return (
    <Field label={label} error={error || undefined} hint={hint}>
      <Combobox<HitOption>
        query={value}
        onQueryChange={onChange}
        keepQuery
        search={search}
        onValueChange={(_, o) => onPick(o.hit)}
        listLabel="Matching places"
        leading={<Search className="size-4" />}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </Field>
  );
}

/**
 * Locate (ADR 0011): the typed address looked up through Nominatim, on the
 * click only — the fallback when the typeahead has no match. One hit is
 * taken; several are offered to choose from; none says so.
 */
export function LocateButton({ address, onFound }: { address: string; onFound: (at: Coords) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<GeocodeHit[]>([]);

  async function locate() {
    setBusy(true);
    setError("");
    setCandidates([]);
    try {
      const hits = await geocode(address);
      if (hits.length === 0) setError("Nothing found for that address.");
      else if (hits.length === 1) onFound({ lat: hits[0]!.lat, lon: hits[0]!.lon });
      else setCandidates(hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The lookup failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-1">
      <Button type="button" variant="outline" size="sm" className="justify-self-start" disabled={busy || !address.trim()} onClick={() => void locate()}>
        {busy ? <Loader2 className="animate-spin" /> : <LocateFixed />} Locate
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
      {candidates.length > 0 && (
        <div className="grid min-w-0 gap-0.5 rounded-md border p-1" role="group" aria-label="Which one?">
          <p className="text-muted-foreground px-1 text-xs">Which one?</p>
          {candidates.map((c, i) => (
            <Button
              key={i}
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto min-w-0 justify-start py-1 text-left font-normal whitespace-normal"
              onClick={() => {
                setCandidates([]);
                onFound({ lat: c.lat, lon: c.lon });
              }}
            >
              <span className="min-w-0 break-words">{c.label}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Where the address stands: on the map, or not yet, and how it will get there. */
export function WhereNote({ address, at }: { address: string; at: Coords | null | undefined }) {
  if (at) {
    return (
      <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-xs">
        <MapPin className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate tabular-nums">
          On the map at {at.lat.toFixed(4)}, {at.lon.toFixed(4)}
        </span>
      </p>
    );
  }
  return <p className="text-muted-foreground text-xs">{address.trim() ? "Not on the map yet: Locate it, or it is looked up when saved." : "No address: it can be added later."}</p>;
}
