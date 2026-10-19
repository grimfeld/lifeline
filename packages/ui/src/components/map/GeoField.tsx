import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, Search, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

export interface GeoCoords {
  lat: number;
  lon: number;
}

export interface GeoCandidate extends GeoCoords {
  label: string;
}

/** Parse "lat, lon" (or "lat lon") typed by hand. */
export function parseCoords(text: string): GeoCoords | null {
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/.exec(text);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export function formatCoords(c: GeoCoords | null | undefined): string {
  return c ? `${c.lat}, ${c.lon}` : "";
}

/**
 * Coordinates editor (ADR 0011): shows "lat, lon" for manual entry, plus a
 * "Locate" action that geocodes `query` (typically the entity's address
 * field) through the caller-supplied geocoder and lets the user pick one of
 * the candidates. Never overwrites the address the user typed. Geocoding
 * only ever runs on the click.
 */
export function GeoField({
  id,
  value,
  onChange,
  query,
  geocode,
  suggest,
  onPickAddress,
  className,
}: {
  id?: string;
  value: GeoCoords | null;
  onChange: (next: GeoCoords | null) => void;
  /** Text to geocode when Locate is clicked (e.g. the address property). */
  query?: string;
  geocode?: (query: string) => Promise<GeoCandidate[]>;
  /** Typeahead: address suggestions while typing (debounced here). Enables the search box. */
  suggest?: (query: string) => Promise<GeoCandidate[]>;
  /** Called with the picked suggestion's label so the caller may fill its address field. */
  onPickAddress?: (label: string) => void;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<GeoCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounce = useRef<number | null>(null);
  useEffect(() => {
    if (!suggest) return;
    if (debounce.current) window.clearTimeout(debounce.current);
    if (search.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    // A slow answer for an older query must not land over a newer one's.
    let alive = true;
    debounce.current = window.setTimeout(() => {
      setSearching(true);
      suggest(search)
        .then((hits) => {
          if (!alive) return;
          setSuggestions(hits);
          setHighlight(0);
        })
        .catch((e) => {
          if (alive && (e as { name?: string }).name !== "AbortError") setError(e instanceof Error ? e.message : "Address search failed.");
        })
        .finally(() => alive && setSearching(false));
    }, 300);
    return () => {
      alive = false;
      if (debounce.current) window.clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  function pickSuggestion(c: GeoCandidate) {
    onChange({ lat: c.lat, lon: c.lon });
    onPickAddress?.(c.label);
    setSearch("");
    setSuggestions([]);
  }
  const [text, setText] = useState(formatCoords(value));
  useEffect(() => setText(formatCoords(value)), [value?.lat, value?.lon]); // eslint-disable-line react-hooks/exhaustive-deps
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<GeoCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalid = text.trim() !== "" && parseCoords(text) === null;
  const canLocate = !!geocode && !!query?.trim();

  function commit() {
    const t = text.trim();
    if (t === "") return onChange(null);
    const c = parseCoords(t);
    if (c) onChange(c);
  }

  async function locate() {
    if (!geocode || !query?.trim()) return;
    setBusy(true);
    setError(null);
    setCandidates(null);
    try {
      const hits = await geocode(query);
      if (hits.length === 0) setError("Nothing found for that address.");
      else if (hits.length === 1) onChange({ lat: hits[0].lat, lon: hits[0].lon });
      else setCandidates(hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geocoding failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("grid gap-1", className)}>
      {suggest && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
          {searching && <Loader2 className="text-muted-foreground absolute top-1/2 right-2 size-3.5 -translate-y-1/2 animate-spin" />}
          <Input
            className="h-8 pl-7 text-xs"
            placeholder="Search an address… (pick to fill coordinates)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                pickSuggestion(suggestions[highlight]);
              } else if (e.key === "Escape") {
                setSuggestions([]);
              }
            }}
            aria-label="Search address"
            aria-autocomplete="list"
          />
          {suggestions.length > 0 && (
            <ul className="bg-popover text-popover-foreground absolute z-20 mt-1 w-full overflow-hidden rounded-md border text-xs shadow-md" role="listbox">
              {suggestions.map((c, i) => (
                <li key={i} role="option" aria-selected={i === highlight}>
                  <button
                    type="button"
                    className={cn("block w-full truncate px-2 py-1.5 text-left", i === highlight ? "bg-accent" : "hover:bg-accent/60")}
                    title={c.label}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(c)}
                  >
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex gap-1">
        <Input
          id={id}
          className={cn("h-8 font-mono text-xs", invalid && "border-destructive")}
          placeholder="lat, lon"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          disabled={!canLocate || busy}
          onClick={() => void locate()}
          title={canLocate ? `Find coordinates for “${query}”` : "Fill in an address first"}
        >
          {busy ? <Loader2 className="animate-spin" /> : <LocateFixed />} Locate
        </Button>
      </div>
      {error && <div className="text-destructive text-xs">{error}</div>}
      {candidates && (
        <div className="bg-popover text-popover-foreground rounded-md border p-1 text-xs shadow-sm">
          <div className="text-muted-foreground flex items-center justify-between px-1 pb-1">
            <span>Which one?</span>
            <button type="button" className="hover:text-foreground" onClick={() => setCandidates(null)} aria-label="Dismiss">
              <X className="size-3" />
            </button>
          </div>
          {candidates.map((c, i) => (
            <button
              key={i}
              type="button"
              className="hover:bg-accent block w-full truncate rounded px-1 py-1 text-left"
              title={c.label}
              onClick={() => {
                onChange({ lat: c.lat, lon: c.lon });
                setCandidates(null);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
