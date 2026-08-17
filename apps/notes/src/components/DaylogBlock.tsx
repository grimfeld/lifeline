import { appById, formatTime, useDaylog, type DateStr } from "@lifeline/core";

/**
 * The live rendering of a `daylog` block (ADR 0009): what happened on the
 * day, from every App implementing the Daylog contract. Also used by the
 * Daylog card. Uses plain anchors (it may render inside a CodeMirror widget,
 * outside the router).
 */
export function DaylogBlock({ date, apps, compact }: { date: DateStr; apps?: string[]; compact?: boolean }) {
  const items = useDaylog(date, apps);
  if (items.length === 0) {
    return <div className="text-muted-foreground text-xs italic">Nothing logged on {date}.</div>;
  }
  return (
    <ul className={compact ? "grid gap-0.5" : "grid gap-1"}>
      {items.map((it) => {
        const app = appById(it.appId);
        const row = (
          <>
            <span className="size-2 shrink-0 rounded-full" style={{ background: it.color ?? "var(--muted-foreground)" }} title={app?.title} />
            {it.time && <span className="text-muted-foreground w-14 shrink-0 text-xs tabular-nums">{formatTime(it.time)}</span>}
            <span className="text-muted-foreground shrink-0 text-xs">{it.kind}</span>
            <span className="truncate text-sm">{it.title}</span>
            {it.subtitle && <span className="text-muted-foreground truncate text-xs">{it.subtitle}</span>}
          </>
        );
        return (
          <li key={it.key} className="flex min-w-0 items-center gap-2">
            {it.href ? (
              <a href={it.href} className="flex min-w-0 items-center gap-2 hover:underline">
                {row}
              </a>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
