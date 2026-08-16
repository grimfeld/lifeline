import { CardUnavailable } from "@lifeline/ui";
import {
  formatHuman,
  parts,
  todayStr,
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
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: c.name }));
}

/** Instance title (a hook, per CardDef.instanceTitle): the chore's name, or the window. */
export function useHeatmapInstanceTitle(settings: CardSettings): string {
  const chores = useChores();
  const chore = settings.chore as string;
  if (chore) return chores.find((c) => c.id === chore)?.name ?? "";
  return `Chores · ${settings.weeks as number} weeks`;
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
  const completions = useCompletions();

  const today = todayStr();
  const days = heatmapDays(weeks, today);
  const perDay = completionsPerDay(completions, days, choreId || undefined);
  const nameOf = (id: string) => chores.find((c) => c.id === id)?.name ?? "Unknown chore";

  if (choreId && !chores.some((c) => c.id === choreId)) {
    return <CardUnavailable message="That chore no longer exists." onConfigure={configure} />;
  }

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

  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto overflow-x-hidden text-xs">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `auto repeat(${cols}, minmax(0, 1fr))` }}>
        <div />
        {monthLabels.map((label, i) => (
          <div key={i} className="text-muted-foreground truncate leading-none">
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
      {total === 0 && (
        <p className="text-muted-foreground mt-auto">No completions in this window yet.</p>
      )}
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
        className={`aspect-square rounded-[2px] ${d === today ? "ring-1 ring-foreground" : ""}`}
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
