import type * as React from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { CardUnavailable } from "@lifeline/ui";
import {
  formatHuman,
  matchesTagFilter,
  parts,
  todayStr,
  useTagFilter,
  type CardOption,
  type CardProps,
  type CardSettings,
  type DateStr,
} from "@lifeline/core";
import { useChores, useCompletions } from "../data/repo";
import { completionsPerDay, heatmapDays } from "../domain/heatmap";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Options hook for the `chore` setting: active + paused chores by name. */
export function useHeatmapChoreOptions(): CardOption[] {
  const chores = useChores();
  return chores
    .filter((c) => c.status !== "archived")
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((c) => ({ value: c.id, label: c.title }));
}

/** Instance title (a hook, per CardDef.instanceTitle): the chore's name, or the window. */
export function useHeatmapInstanceTitle(settings: CardSettings): string {
  const chores = useChores();
  const chore = settings.chore as string;
  if (chore) return chores.find((c) => c.id === chore)?.title ?? "";
  return `Chores · ${settings.weeks as number} weeks`;
}

const GAP = 3;
const LABEL_W = 12;
const LABEL_H = 12;

/**
 * Cell size that fits the whole grid (label column/row + cols×7 cells) in
 * both the container's width and height, so every row is always visible.
 */
function useCellSize(cols: number, reserve: number): { ref: React.RefObject<HTMLDivElement | null>; cell: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [cell, setCell] = useState(10);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - LABEL_W - GAP * cols;
      const h = el.clientHeight - reserve - LABEL_H - GAP * 7;
      setCell(Math.max(4, Math.floor(Math.min(w / cols, h / 7))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cols, reserve]);
  return { ref, cell };
}

function opacityFor(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 0.35;
  if (n === 2) return 0.65;
  return 1;
}

/** Card: GitHub-style grid of completions per day over the last N weeks. */
export function HeatmapCard({ settings, configure }: CardProps) {
  const weeks = settings.weeks as number;
  const choreId = settings.chore as string;
  const chores = useChores();
  const allCompletions = useCompletions();
  // Tag filter (ADR 0014): completions inherit their chore's tags.
  const filter = useTagFilter();
  // A heatmap pinned to one chore is a single-entity view: the filter does not apply.
  const passing = new Set(chores.filter((c) => choreId === c.id || (!choreId && matchesTagFilter(c.tags, filter))).map((c) => c.id));
  const completions = allCompletions.filter((c) => passing.has(c.choreId));

  const today = todayStr();
  const days = heatmapDays(weeks, today);
  const perDay = completionsPerDay(completions, days, choreId || undefined);
  const nameOf = (id: string) => chores.find((c) => c.id === id)?.title ?? "Unknown chore";

  const cols = days.length / 7;
  // Month label at the column where a new month starts (first row cell).
  const monthLabels: (string | null)[] = [];
  let lastMonth = -1;
  for (let w = 0; w < cols; w++) {
    const { m } = parts(days[w * 7]);
    monthLabels.push(m !== lastMonth ? MONTHS[m - 1] : null);
    lastMonth = m;
  }
  const total = days.reduce((n, d) => n + (perDay.get(d)?.length ?? 0), 0);
  const { ref, cell } = useCellSize(cols, total === 0 ? 20 : 0);

  // After every hook: on the first render the chores have not loaded yet.
  if (choreId && !chores.some((c) => c.id === choreId)) {
    return <CardUnavailable message="That chore no longer exists." onConfigure={configure} />;
  }

  return (
    <div ref={ref} className="flex h-full flex-col gap-1 overflow-hidden text-xs">
      <div
        className="grid gap-[3px]"
        style={{
          gridTemplateColumns: `${LABEL_W}px repeat(${cols}, ${cell}px)`,
          gridTemplateRows: `${LABEL_H}px repeat(7, ${cell}px)`,
        }}
      >
        <div />
        {monthLabels.map((label, i) => (
          // A month name overhangs its one-cell column into the empty ones after it, on purpose.
          <div key={i} data-layout-ignore className="text-muted-foreground overflow-visible leading-none whitespace-nowrap">
            {label ?? ""}
          </div>
        ))}
        {WEEKDAY_LETTERS.map((letter, row) => (
          <RowCells
            key={row}
            letter={letter}
            row={row}
            cols={cols}
            days={days}
            perDay={perDay}
            today={today}
            nameOf={nameOf}
          />
        ))}
      </div>
      {total === 0 && <p className="text-muted-foreground">No completions in this window yet.</p>}
    </div>
  );
}

function RowCells({
  letter,
  row,
  cols,
  days,
  perDay,
  today,
  nameOf,
}: {
  letter: string;
  row: number;
  cols: number;
  days: DateStr[];
  perDay: Map<DateStr, { choreId: string }[]>;
  today: DateStr;
  nameOf: (id: string) => string;
}) {
  const cells = [];
  for (let w = 0; w < cols; w++) {
    const d = days[w * 7 + row];
    const done = perDay.get(d) ?? [];
    const n = done.length;
    const future = d > today;
    const title =
      `${formatHuman(d)} — ${n === 0 ? "nothing done" : done.map((c) => nameOf(c.choreId)).join(", ")}`;
    cells.push(
      <div
        key={d}
        title={title}
        className={`rounded-[2px] ${d === today ? "ring-1 ring-foreground" : ""}`}
        style={{
          backgroundColor: n === 0 ? "var(--muted)" : "var(--chart-aqua)",
          opacity: future ? 0 : n === 0 ? undefined : opacityFor(n),
        }}
      />,
    );
  }
  return (
    <>
      <div className="text-muted-foreground flex items-center leading-none">{letter}</div>
      {cells}
    </>
  );
}
