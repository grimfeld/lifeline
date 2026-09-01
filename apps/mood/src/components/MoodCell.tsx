import { formatHuman, type DateStr } from "@lifeline/core";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, cn } from "@lifeline/ui";
import { MOOD_STEPS, moodLabel, stepOf, type MoodLevel } from "../domain/types";

export interface MoodCellProps {
  date: DateStr;
  level: MoodLevel | null;
  today: DateStr;
  /** Side of the square, in px. */
  size: number;
  onSet: (date: DateStr, level: MoodLevel) => void;
  onClear: (date: DateStr) => void;
  /** Show the day number inside the square (the month layout does). */
  showDay?: boolean;
}

const squareStyle = (level: MoodLevel | null, size: number) => ({
  width: size,
  height: size,
  background: level === null ? "var(--muted)" : stepOf(level).color,
});

/**
 * One day of the grid: a square coloured by its Mood, or muted when nothing
 * is recorded — an absence, never a sixth mood (ADR 0044). Clicking opens
 * the five moods; keys 1–5 pick one while the menu is open. A day still
 * ahead is drawn empty and does not open: you can't have felt it yet.
 */
export function MoodCell({ date, level, today, size, onSet, onClear, showDay }: MoodCellProps) {
  const future = date > today;
  const day = Number(date.slice(8));
  const title = `${formatHuman(date)}${level === null ? " — no mood" : ` — ${moodLabel(level)}`}`;

  if (future) {
    return <div aria-hidden className="rounded-[3px] border border-dashed opacity-40" style={{ width: size, height: size }} />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={title}
          aria-label={title}
          className={cn(
            "flex items-center justify-center rounded-[3px] text-[9px] leading-none transition-opacity hover:opacity-70",
            level === null && "text-muted-foreground",
            level !== null && "text-white/90",
            date === today && "ring-foreground ring-2",
          )}
          style={squareStyle(level, size)}
        >
          {showDay && size >= 22 ? day : ""}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        onKeyDown={(e) => {
          const n = Number(e.key);
          if (Number.isInteger(n) && n >= 1 && n <= 5) {
            e.preventDefault();
            onSet(date, n as MoodLevel);
            // Close the menu the way a selection would.
            (e.currentTarget as HTMLElement).dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          }
        }}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">{formatHuman(date)}</DropdownMenuLabel>
        {MOOD_STEPS.map((s) => (
          <DropdownMenuItem key={s.level} onSelect={() => onSet(date, s.level)}>
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-[3px]" style={{ background: s.color }} />
              <span>
                {s.emoji} {s.label}
              </span>
            </span>
            <span className="text-muted-foreground ml-auto text-xs tabular-nums">{s.level}</span>
          </DropdownMenuItem>
        ))}
        {level !== null && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onClear(date)}>Clear</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
