import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import type { Entry, Stat } from "../domain/types";
import { collectedItems, noonOf } from "../domain/aggregate";
import { addEntry } from "../data/repo";

function nowLocalInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Log (or mark) an entry. Backdating is allowed: `ts` is when it happened. */
export function AddEntryDialog({
  open,
  onOpenChange,
  stat,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stat: Stat;
  /** This stat's entries — for the collection item autocomplete. */
  entries: Entry[];
}) {
  const [value, setValue] = useState("");
  const [item, setItem] = useState("");
  const [when, setWhen] = useState(nowLocalInput());
  const [day, setDay] = useState(todayStr());
  const known = useMemo(() => collectedItems(entries).map((i) => i.name), [entries]);

  useEffect(() => {
    if (!open) return;
    setValue(stat.kind === "additive" && stat.defaultIncrement ? String(stat.defaultIncrement) : "");
    setItem("");
    setWhen(nowLocalInput());
    setDay(todayStr());
  }, [open, stat]);

  async function submit() {
    if (stat.kind === "boolean") {
      await addEntry({ statId: stat.id, value: 1, ts: noonOf(day) });
      toast.success(`${stat.title} marked for ${day}`);
    } else if (stat.kind === "collection") {
      if (!item.trim()) return void toast.error("Name the item");
      await addEntry({ statId: stat.id, value: 1, item: item.trim(), ts: new Date(when).toISOString() });
      toast.success(`${item.trim()} added to ${stat.title}`);
    } else {
      const v = Number(value);
      if (!value.trim() || Number.isNaN(v)) return void toast.error("Enter a number");
      await addEntry({ statId: stat.id, value: v, ts: new Date(when).toISOString() });
      toast.success(`${stat.title}: ${v}${stat.unit ? ` ${stat.unit}` : ""} logged`);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {stat.kind === "boolean" ? "Mark" : "Log"} {stat.title}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {stat.kind === "boolean" ? (
            <div className="grid gap-2">
              <Label htmlFor="entry-day">Day</Label>
              <Input id="entry-day" type="date" value={day} max={todayStr()} onChange={(e) => setDay(e.target.value)} />
            </div>
          ) : (
            <>
              {stat.kind === "collection" ? (
                <div className="grid gap-2">
                  <Label htmlFor="entry-item">Item</Label>
                  <Input id="entry-item" list="entry-items" value={item} autoFocus onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
                  <datalist id="entry-items">
                    {known.map((k) => (
                      <option key={k} value={k} />
                    ))}
                  </datalist>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="entry-value">
                    {stat.kind === "measurement" ? "Reading" : "Amount"}
                    {stat.unit ? ` (${stat.unit})` : ""}
                  </Label>
                  <Input id="entry-value" type="number" step="any" inputMode="decimal" value={value} autoFocus onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="entry-when">When</Label>
                <Input id="entry-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{stat.kind === "boolean" ? "Mark" : "Log"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
