import { addDays, formatHuman, todayStr, type CardProps } from "@lifeline/core";
import { DaylogBlock } from "@lifeline/editor";

/** Card: the Daylog for a day (knob: day offset) — same rendering as the in-note block. */
export function DaylogCard({ settings }: CardProps) {
  const offset = Number(settings.offset ?? 0);
  const date = addDays(todayStr(), offset);
  return (
    <div className="flex h-full flex-col gap-1 overflow-y-auto">
      {offset !== 0 && <div className="text-muted-foreground text-xs">{formatHuman(date)}</div>}
      <DaylogBlock date={date} />
    </div>
  );
}
