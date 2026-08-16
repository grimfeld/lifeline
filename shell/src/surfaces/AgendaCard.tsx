import { useEffect, useMemo, useRef, useState } from "react";
import { appById, formatTime, hourWindow, layoutColumns, todayStr, useTimedItems, type CardProps } from "@lifeline/core";
import { cn } from "@lifeline/ui";

const HOUR_PX = 48;

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Hub card: today's Timed items on an hour-scaled timeline with a live "now" line. */
export function AgendaCard({ settings }: CardProps) {
  const today = todayStr();
  const items = useTimedItems({ start: today, end: today });
  const now = useNow();
  const startHour = Number(settings.startHour ?? 7);
  const endHour = Number(settings.endHour ?? 23);
  const { from, to } = useMemo(() => hourWindow(items, startHour, endHour), [items, startHour, endHour]);
  const allDay = items.filter((i) => !i.start);
  const columns = useMemo(() => layoutColumns(items), [items]);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const scroller = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);

  useEffect(() => {
    if (didScroll.current || !scroller.current) return;
    didScroll.current = true;
    const y = (nowH - from) * HOUR_PX - scroller.current.clientHeight / 3;
    scroller.current.scrollTop = Math.max(0, y);
  }, [nowH, from]);

  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const height = (to - from) * HOUR_PX;

  return (
    <div className="flex h-full flex-col gap-1">
      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b pb-1">
          {allDay.map((t) => (
            <span
              key={t.key}
              className="truncate rounded px-1.5 py-0.5 text-xs text-white"
              style={{ background: t.color ?? "var(--muted-foreground)" }}
              title={appById(t.appId)?.title}
            >
              {t.title}
            </span>
          ))}
        </div>
      )}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height }}>
          {hours.map((h) => (
            <div key={h} className="absolute right-0 left-0 flex" style={{ top: (h - from) * HOUR_PX, height: HOUR_PX }}>
              <span className="text-muted-foreground w-10 shrink-0 -translate-y-1.5 text-right text-[10px] tabular-nums pr-1">
                {formatTime(`${String(h).padStart(2, "0")}:00`)}
              </span>
              <span className="border-border/60 flex-1 border-t" />
            </div>
          ))}
          <div className="absolute right-0 left-10">
            {columns.map(({ item, start: s, end: e, col, cols }) => {
              return (
                <div
                  key={item.key}
                  className="absolute overflow-hidden rounded-sm px-1.5 py-0.5 text-xs text-white"
                  style={{
                    top: (s - from) * HOUR_PX + 1,
                    height: (e - s) * HOUR_PX - 2,
                    left: `${(col / cols) * 100}%`,
                    width: `calc(${100 / cols}% - 2px)`,
                    background: item.color ?? "var(--muted-foreground)",
                  }}
                  title={`${formatTime(item.start)}${item.end ? `–${formatTime(item.end)}` : ""} ${item.title}`}
                >
                  <div className="truncate font-medium">{item.title}</div>
                  <div className="truncate opacity-80">
                    {formatTime(item.start)}
                    {item.end ? `–${formatTime(item.end)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {nowH >= from && nowH <= to && (
            <div
              className={cn("pointer-events-none absolute right-0 left-8 z-10 flex items-center")}
              style={{ top: (nowH - from) * HOUR_PX }}
            >
              <span className="bg-destructive size-2 rounded-full" />
              <span className="bg-destructive h-px flex-1" />
            </div>
          )}
        </div>
      </div>
      {items.length === 0 && (
        <div className="text-muted-foreground -mt-2 pb-1 text-center text-xs">Nothing timed today.</div>
      )}
    </div>
  );
}
