import { useMemo } from "react";
import { CardUnavailable, cn } from "@lifeline/ui";
import type { CardOption, CardProps, CardSettings, CardSettingsSchema } from "@lifeline/core";
import { AlertTriangle } from "lucide-react";
import { useLiveValues } from "../data/repo";
import { ago, periodMs, useSourceCache } from "../data/cache";
import { hostOf } from "../domain/url";
import { extractValue, formatValue } from "../domain/value";
import type { LiveValue } from "../domain/types";

function useValueOptions(): CardOption[] {
  return useLiveValues()
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({ value: v.id, label: `${v.name} · ${hostOf(v.url)}` }));
}

export const liveValueCardSettings: CardSettingsSchema = {
  value: { kind: "entity", label: "Live value", required: true, useOptions: useValueOptions },
};

export function useLiveValueCardTitle(settings: CardSettings): string {
  return useLiveValues().find((v) => v.id === settings.value)?.name ?? "";
}

/** Card (ADR 0017): one Live value as a tile — big number, unit, "as of", stale marker. */
export function LiveValueCard({ settings, configure }: CardProps) {
  const v = useLiveValues().find((x) => x.id === settings.value);
  if (!v) return <CardUnavailable message="That live value no longer exists." onConfigure={configure} />;
  return <ValueTile value={v} />;
}

export function ValueTile({ value: v, className }: { value: LiveValue; className?: string }) {
  const entry = useSourceCache(v);
  const read = useMemo(() => {
    if (!entry?.body) return null;
    try {
      return { text: formatValue(extractValue(entry.body, v.mode, v.path), v) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [entry?.body, v]);
  const stale = !!entry && Date.now() - Date.parse(entry.fetchedAt) > 2 * periodMs(v);
  const problem = read && "error" in read ? read.error : !entry?.ok && !entry?.body ? entry?.error : null;

  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-1 text-center", className)}>
      {!entry ? (
        <div className="text-muted-foreground text-xs">Fetching…</div>
      ) : problem ? (
        <>
          <AlertTriangle className="text-destructive size-5" />
          <div className="text-muted-foreground line-clamp-3 px-2 text-xs">{problem}</div>
        </>
      ) : (
        <div className={cn("max-w-full break-words px-2 text-3xl font-semibold leading-none tabular-nums", stale && "text-muted-foreground")}>{read && "text" in read ? read.text : "—"}</div>
      )}
      <div className="mt-1 w-full truncate px-2 text-sm font-medium">{v.name}</div>
      {entry && (
        <div className="text-muted-foreground flex items-center gap-1 text-[10px]">
          {(!entry.ok || stale) && <AlertTriangle className="text-destructive size-3" />}
          as of {ago(entry.fetchedAt)}
          {stale && " · stale"}
        </div>
      )}
    </div>
  );
}
