import { Button, cn, toast } from "@lifeline/ui";
import {
  appById,
  completeSurfaceItem,
  formatTime,
  todayStr,
  useSurfaceItems,
  useTimedItems,
} from "@lifeline/core";
import { Check } from "lucide-react";

/**
 * Cross-app Today feed: every Schedulable item landing on today, plus today's
 * Time blocks (ADR 0028) — a block today is today's work, listed with its
 * hour; the item's own row is left out when a block already says it.
 */
export function TodayCard() {
  const today = todayStr();
  const rows = useSurfaceItems({ start: today, end: today });
  const blocks = rows.filter((r) => r.start).sort((a, b) => a.start!.localeCompare(b.start!));
  const blocked = new Set(blocks.map((b) => b.key));
  const items = rows.filter((r) => !r.start && !blocked.has(r.key));
  // Time blockers are bands on the hour-scaled Schedule, not things on a day (ADR 0027).
  const timed = useTimedItems({ start: today, end: today }).filter((t) => !t.background);
  const open = items.filter((i) => !i.completedOn);
  const done = items.filter((i) => i.completedOn);

  if (items.length === 0 && timed.length === 0 && blocks.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Nothing on today's plate.
      </div>
    );
  }

  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {timed.map((t) => (
        <li key={t.key} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <span className="text-muted-foreground w-16 shrink-0 text-xs">
            {t.start ? formatTime(t.start) : "All day"}
          </span>
          <span className="truncate text-sm">{t.title}</span>
          <span
            className="ml-auto size-2 shrink-0 rounded-sm"
            style={{ background: t.color ?? "var(--muted-foreground)" }}
            title={appById(t.appId)?.title}
          />
        </li>
      ))}
      {blocks.map((b) => (
        <li key={b.placementId} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <span className="text-muted-foreground w-16 shrink-0 text-xs">{formatTime(b.start!)}</span>
          {b.completedOn ? (
            <Check className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <Button
              size="icon"
              variant="outline"
              className="size-6 shrink-0 rounded-full"
              onClick={() => {
                void completeSurfaceItem(b);
                toast.success(`${b.title} done`);
              }}
            >
              <Check className="size-3" />
            </Button>
          )}
          <span className={cn("truncate text-sm", b.completedOn && "text-muted-foreground line-through")}>{b.title}</span>
          <span className="ml-auto size-2 shrink-0 rounded-full" style={{ background: b.color ?? "var(--muted-foreground)" }} title={appById(b.appId)?.title} />
        </li>
      ))}
      {[...open, ...done].map((item) => (
        <li key={item.key} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          {item.completedOn ? (
            <Check className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <Button
              size="icon"
              variant="outline"
              className="size-6 shrink-0 rounded-full"
              onClick={() => {
                void completeSurfaceItem(item);
                toast.success(`${item.title} done`);
              }}
            >
              <Check className="size-3" />
            </Button>
          )}
          <span
            className={cn(
              "truncate text-sm",
              item.completedOn && "text-muted-foreground line-through",
            )}
          >
            {item.title}
          </span>
          <span
            className="ml-auto size-2 shrink-0 rounded-full"
            style={{ background: item.color ?? "var(--muted-foreground)" }}
            title={appById(item.appId)?.title}
          />
        </li>
      ))}
    </ul>
  );
}
