import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from "@lifeline/ui";
import { todayStr, type Weekday } from "@lifeline/core";
import type { Chore, Schedule } from "../domain/types";
import { addChore, updateChore } from "../data/repo";

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function ChoreDialog({
  open,
  onOpenChange,
  chore,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  chore?: Chore;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [kind, setKind] = useState<Schedule["kind"]>("weekly");
  const [weekdays, setWeekdays] = useState<Weekday[]>([1]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [intervalDays, setIntervalDays] = useState(7);

  useEffect(() => {
    if (!open) return;
    setName(chore?.name ?? "");
    setCategory(chore?.category ?? "");
    const s = chore?.schedule;
    setKind(s?.kind ?? "weekly");
    setWeekdays(s?.kind === "weekly" ? s.weekdays : [1]);
    setDayOfMonth(s?.kind === "monthly" ? s.dayOfMonth : 1);
    setMonth(s?.kind === "yearly" ? s.month : 1);
    setDay(s?.kind === "yearly" ? s.day : 1);
    setIntervalDays(s?.kind === "interval" ? s.days : 7);
  }, [open, chore]);

  function buildSchedule(): Schedule | null {
    switch (kind) {
      case "weekly":
        return weekdays.length ? { kind, weekdays: [...weekdays].sort() } : null;
      case "monthly":
        return { kind, dayOfMonth };
      case "yearly":
        return { kind, month, day };
      case "interval":
        return intervalDays >= 1 ? { kind, days: intervalDays } : null;
    }
  }

  async function submit() {
    const schedule = buildSchedule();
    if (!name.trim() || !schedule) {
      toast.error(!name.trim() ? "Name required" : "Pick at least one weekday");
      return;
    }
    if (chore) {
      await updateChore({ ...chore, name: name.trim(), category: category.trim() || null, schedule });
      toast.success("Chore updated");
    } else {
      await addChore({
        name: name.trim(),
        category: category.trim() || null,
        schedule,
        anchorDate: schedule.kind === "interval" ? todayStr() : null,
      });
      toast.success("Chore added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{chore ? "Edit chore" : "New chore"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="chore-name">Name</Label>
            <Input
              id="chore-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Water the plants"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="chore-category">Category</Label>
            <Input
              id="chore-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Kitchen (optional)"
            />
          </div>
          <div className="grid gap-2">
            <Label>Schedule</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Schedule["kind"])}>
              <SelectTrigger>
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

          {kind === "weekly" && (
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((wd) => (
                <label key={wd.value} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={weekdays.includes(wd.value)}
                    onCheckedChange={(v) =>
                      setWeekdays((cur) =>
                        v ? [...cur, wd.value] : cur.filter((x) => x !== wd.value),
                      )
                    }
                  />
                  {wd.label}
                </label>
              ))}
            </div>
          )}
          {kind === "monthly" && (
            <div className="grid gap-2">
              <Label htmlFor="chore-dom">Day of month (1–31)</Label>
              <Input
                id="chore-dom"
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
              />
            </div>
          )}
          {kind === "yearly" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="chore-month">Month (1–12)</Label>
                <Input
                  id="chore-month"
                  type="number"
                  min={1}
                  max={12}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="chore-day">Day</Label>
                <Input
                  id="chore-day"
                  type="number"
                  min={1}
                  max={31}
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                />
              </div>
            </div>
          )}
          {kind === "interval" && (
            <div className="grid gap-2">
              <Label htmlFor="chore-interval">Every N days</Label>
              <Input
                id="chore-interval"
                type="number"
                min={1}
                value={intervalDays}
                onChange={(e) => setIntervalDays(Number(e.target.value))}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{chore ? "Save" : "Add chore"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
