import type { DateStr } from "@lifeline/core";
import { MONTH_LABELS, WEEKDAY_LABELS, monthWeeks, yearColumns } from "../domain/grid";
import type { MoodLevel } from "../domain/types";
import { MoodCell } from "./MoodCell";

interface GridProps {
  byDate: Map<DateStr, MoodLevel>;
  today: DateStr;
  size: number;
  onSet: (date: DateStr, level: MoodLevel) => void;
  onClear: (date: DateStr) => void;
}

const GAP = 3;

/** One month, weekday-aligned, weeks starting Monday. */
export function MonthGrid({ byDate, today, size, onSet, onClear, y, m }: GridProps & { y: number; m: number }) {
  const weeks = monthWeeks(y, m);
  return (
    <div className="inline-grid" style={{ gap: GAP, gridTemplateColumns: `repeat(7, ${size}px)` }}>
      {WEEKDAY_LABELS.map((w) => (
        <div key={w} className="text-muted-foreground text-center text-[10px] leading-4">
          {w.slice(0, size >= 28 ? 3 : 1)}
        </div>
      ))}
      {weeks.flat().map((date, i) =>
        date === null ? (
          <div key={`pad-${i}`} style={{ width: size, height: size }} />
        ) : (
          <MoodCell key={date} date={date} level={byDate.get(date) ?? null} today={today} size={size} onSet={onSet} onClear={onClear} showDay />
        ),
      )}
    </div>
  );
}

/**
 * One year as twelve month-columns of 31 day-rows — the whole year read at a
 * glance, which is the point of the grid (ADR 0044).
 */
export function YearGrid({ byDate, today, size, onSet, onClear, y }: GridProps & { y: number }) {
  const cols = yearColumns(y);
  const dayLabelWidth = 16;
  const rows = [];
  for (let d = 0; d < 31; d++) {
    rows.push(
      <div key={`label-${d}`} className="text-muted-foreground text-right text-[9px] leading-none" style={{ width: dayLabelWidth, alignSelf: "center" }}>
        {(d + 1) % 5 === 0 || d === 0 ? d + 1 : ""}
      </div>,
    );
    for (let m = 0; m < 12; m++) {
      const date = cols[m]?.[d];
      rows.push(
        date == null ? (
          <div key={`pad-${m}-${d}`} style={{ width: size, height: size }} />
        ) : (
          <MoodCell key={date} date={date} level={byDate.get(date) ?? null} today={today} size={size} onSet={onSet} onClear={onClear} />
        ),
      );
    }
  }
  return (
    <div className="inline-grid" style={{ gap: GAP, gridTemplateColumns: `${dayLabelWidth}px repeat(12, ${size}px)` }}>
      <div />
      {MONTH_LABELS.map((label) => (
        <div key={label} className="text-muted-foreground text-center text-[10px] leading-4">
          {size >= 16 ? label : label.slice(0, 1)}
        </div>
      ))}
      {rows}
    </div>
  );
}

/** The scale, drawn once under a grid. */
export function MoodLegend({ steps, compact }: { steps: { level: number; emoji: string; label: string; color: string }[]; compact?: boolean }) {
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {steps.map((s) => (
        <span key={s.level} className="flex items-center gap-1">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          {compact ? s.emoji : `${s.emoji} ${s.label}`}
        </span>
      ))}
      <span className="flex items-center gap-1">
        <span className="size-2.5 rounded-[3px]" style={{ background: "var(--muted)" }} />
        nothing recorded
      </span>
    </div>
  );
}
