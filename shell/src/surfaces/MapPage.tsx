import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { EVENT_TYPE, PLACE_TYPE, documentType, openPin, useDocumentTypes, useDocuments, useLocatablePins, useLocatableTypes } from "@lifeline/core";
import { cn, MapView, PageHeader, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { MapPin, Sparkles } from "lucide-react";
import { mapPins } from "./mapFilter";

const ANY = "__any__";

/**
 * The Map Surface (ADR 0011): every Locatable Document as a pin, filtered
 * per Document type with session-only chips. While Places are on, a Kind and
 * To try narrow them and the Events At them (ADR 0135); the choice is kept
 * while Places are off. `?focus=type/id` centres on one pin.
 */
export function MapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focus = params.get("focus") ?? undefined;
  const providers = useLocatableTypes();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const all = useLocatablePins();
  const places = useDocuments(PLACE_TYPE);
  // An Event At a Place follows its Place through Kind and To try (#505): its At is read from it.
  const events = useDocuments(EVENT_TYPE);
  const docs = useMemo(() => [...places, ...events], [places, events]);
  useDocumentTypes();
  const kinds = documentType(PLACE_TYPE)?.fields.find((f) => f.key === "kind")?.options ?? [];
  const [kind, setKind] = useState("");
  const [toTry, setToTry] = useState(false);
  const hasPlaces = providers.some((p) => p.value === PLACE_TYPE);
  const showPlaceFilters = hasPlaces && !hidden.has(PLACE_TYPE);
  const pins = useMemo(() => mapPins(all, docs, { hidden: [...hidden], kind, toTry }), [all, docs, hidden, kind, toTry]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) m.set(p.type, (m.get(p.type) ?? 0) + 1);
    return m;
  }, [all]);

  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <MapPin className="text-muted-foreground size-4" />
        <PageHeader title="Map" />
        <span className="text-muted-foreground text-xs">
          {pins.length} {pins.length === 1 ? "pin" : "pins"}
        </span>
        <PhoneDock order={1}>
          {/* ui-allow: viewport-breakpoint — inside the PhoneDock, which is the phone's own chrome: these follow the device, as the dock does. */}
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1 max-md:w-full">
            {providers.map((p) => {
              const on = !hidden.has(p.value);
              const color = all.find((x) => x.type === p.value)?.color;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => toggle(p.value)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors max-md:h-8 max-md:justify-center max-md:px-3",
                    on ? "bg-accent" : "text-muted-foreground opacity-60",
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: color ?? "var(--chart-green)" }} />
                  {p.label}
                  <span className="text-muted-foreground tabular-nums">{counts.get(p.value) ?? 0}</span>
                </button>
              );
            })}
            {showPlaceFilters && (
              <>
                <button
                  type="button"
                  onClick={() => setToTry((on) => !on)}
                  aria-pressed={toTry}
                  className={cn(
                    // ui-allow: viewport-breakpoint — inside the PhoneDock, which is the phone's own chrome: these follow the device, as the dock does.
                    "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors max-md:h-8 max-md:justify-center max-md:px-3",
                    toTry ? "bg-accent" : "text-muted-foreground",
                  )}
                >
                  <Sparkles className="size-3" /> To try
                </button>
                <Select value={kind || ANY} onValueChange={(v) => setKind(v === ANY ? "" : v)}>
                  {/* ui-allow: viewport-breakpoint — inside the PhoneDock, which is the phone's own chrome: these follow the device, as the dock does. */}
                  <SelectTrigger size="sm" className="min-w-0 max-md:h-8 max-md:flex-1 md:w-40" aria-label="Kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any kind</SelectItem>
                    {kinds.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </PhoneDock>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {providers.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No Document type is Locatable yet — give a type a Coordinates field.</div>
        ) : (
          <MapView pins={pins} focus={focus} onOpen={(p) => openPin(p, navigate)} />
        )}
      </div>
    </div>
  );
}
