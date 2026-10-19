import { Checkbox, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import type { Weekday } from "@lifeline/core";
import type { Schedule } from "../domain/types";
import type { ScheduleDraft } from "../domain/scheduleDraft";

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/**
 * How a Chore's Schedule is edited — its kind, then that kind's numbers. The
 * one set of controls for the Chore dialog and the Chore's Peek (ADR 0085);
 * `idPrefix` keeps their ids apart when a Peek sits over the dialog's page.
 */
export function ScheduleFields({ value, onChange, idPrefix, error }: { value: ScheduleDraft; onChange: (d: ScheduleDraft) => void; idPrefix: string; error?: string }) {
  const set = (patch: Partial<ScheduleDraft>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}schedule`}>Schedule</Label>
        <Select value={value.kind} onValueChange={(v) => set({ kind: v as Schedule["kind"] })}>
          <SelectTrigger id={`${idPrefix}schedule`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Weekly (fixed weekdays)</SelectItem>
            <SelectItem value="monthly">Monthly (day of month)</SelectItem>
            <SelectItem value="yearly">Yearly (fixed date)</SelectItem>
            <SelectItem value="interval">Every N days after done</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.kind === "weekly" && (
        <div className="flex flex-wrap gap-3">
          {WEEKDAYS.map((wd) => (
            <label key={wd.value} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={value.weekdays.includes(wd.value)}
                onCheckedChange={(v) => set({ weekdays: v ? [...value.weekdays, wd.value] : value.weekdays.filter((x) => x !== wd.value) })}
              />
              {wd.label}
            </label>
          ))}
        </div>
      )}
      {value.kind === "monthly" && (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}dom`}>Day of month (1–31)</Label>
          <Input id={`${idPrefix}dom`} type="number" min={1} max={31} value={value.dayOfMonth} onChange={(e) => set({ dayOfMonth: Number(e.target.value) })} />
        </div>
      )}
      {value.kind === "yearly" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}month`}>Month (1–12)</Label>
            <Input id={`${idPrefix}month`} type="number" min={1} max={12} value={value.month} onChange={(e) => set({ month: Number(e.target.value) })} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}day`}>Day</Label>
            <Input id={`${idPrefix}day`} type="number" min={1} max={31} value={value.day} onChange={(e) => set({ day: Number(e.target.value) })} />
          </div>
        </div>
      )}
      {value.kind === "interval" && (
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}interval`}>Every N days</Label>
          <Input id={`${idPrefix}interval`} type="number" min={1} value={value.intervalDays} onChange={(e) => set({ intervalDays: Number(e.target.value) })} />
        </div>
      )}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </>
  );
}
