import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { appById, locatableProviders, useLocatablePins } from "@lifeline/core";
import { cn, MapView } from "@lifeline/ui";
import { MapPin } from "lucide-react";

/**
 * The Map Surface (ADR 0011): every Locatable pin from every App, filtered
 * per App with session-only chips. `?focus=appId/itemId` centres on one pin.
 */
export function MapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focus = params.get("focus") ?? undefined;
  const providers = locatableProviders();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const all = useLocatablePins();
  const pins = useMemo(() => all.filter((p) => !hidden.has(p.appId)), [all, hidden]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) m.set(p.appId, (m.get(p.appId) ?? 0) + 1);
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
        <h1 className="text-lg font-semibold tracking-tight">Map</h1>
        <span className="text-muted-foreground text-xs">
          {pins.length} {pins.length === 1 ? "pin" : "pins"}
        </span>
        <div className="ml-auto flex flex-wrap gap-1">
          {providers.map((p) => {
            const app = appById(p.appId);
            const on = !hidden.has(p.appId);
            return (
              <button
                key={p.appId}
                type="button"
                onClick={() => toggle(p.appId)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  on ? "bg-accent" : "text-muted-foreground opacity-60",
                )}
              >
                <span className="size-2 rounded-full" style={{ background: app?.color ?? "var(--muted-foreground)" }} />
                {app?.title ?? p.appId}
                <span className="text-muted-foreground tabular-nums">{counts.get(p.appId) ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-2">
        {providers.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">No app puts anything on the map yet.</div>
        ) : (
          <MapView pins={pins} focus={focus} onOpen={(p) => p.href && navigate(p.href)} />
        )}
      </div>
    </div>
  );
}
