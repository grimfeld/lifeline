import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, DateTimeField, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import type { Entry, Stat } from "../domain/types";
import { checklist, noonOf } from "../domain/aggregate";
import { addEntry, uncollectItem } from "../data/repo";

function nowLocalInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Log (or mark) an entry. Backdating is allowed: `ts` is when it happened.
 * A Collection with preset items is a checklist instead: ticking logs the item
 * at "When", unticking deletes its entries (the item stays on the list).
 */
export function AddEntryDialog({
  open,
  onOpenChange,
  stat,
  entries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stat: Stat;
  /** This stat's entries — for what a checklist shows as ticked. */
  entries: Entry[];
}) {
  const [value, setValue] = useState("");
  const [item, setItem] = useState("");
  const [when, setWhen] = useState(nowLocalInput());
  const [day, setDay] = useState(todayStr());
  const [busy, setBusy] = useState<string | null>(null);
  const isChecklist = stat.kind === "collection" && stat.items.length > 0;
  const rows = useMemo(() => (isChecklist ? checklist(stat.items, entries) : []), [isChecklist, stat.items, entries]);

  useEffect(() => {
    if (!open) return;
    setValue(stat.kind === "additive" && stat.defaultIncrement ? String(stat.defaultIncrement) : "");
    setItem("");
    setWhen(nowLocalInput());
    setDay(todayStr());
  }, [open, stat]);

  async function toggle(name: string, collected: boolean) {
    if (busy) return;
    setBusy(name);
    try {
      if (collected) await uncollectItem(stat.id, name);
      else await addEntry({ statId: stat.id, value: 1, item: name, ts: new Date(when).toISOString() });
    } finally {
      setBusy(null);
    }
  }

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
              {isChecklist ? (
                <ul className="-mx-1 grid max-h-[50vh] gap-0.5 overflow-y-auto">
                  {rows.map((r) => {
                    const collected = r.collectedAt !== null;
                    const id = `entry-check-${r.name}`;
                    return (
                      <li key={r.name} className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-1 py-1.5">
                        <Checkbox id={id} checked={collected} disabled={busy === r.name} onCheckedChange={() => void toggle(r.name, collected)} />
                        <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm">
                          {r.name}
                          {!r.listed && <span className="text-muted-foreground ml-1 text-xs">(not on the list)</span>}
                        </label>
                        {r.collectedAt && <span className="text-muted-foreground shrink-0 text-xs">{new Date(r.collectedAt).toLocaleDateString()}</span>}
                      </li>
                    );
                  })}
                </ul>
              ) : stat.kind === "collection" ? (
                <div className="grid gap-2">
                  <Label htmlFor="entry-item">Item</Label>
                  <Input id="entry-item" autoComplete="off" value={item} autoFocus onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
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
                <Label htmlFor="entry-when">{isChecklist ? "Ticked items are logged at" : "When"}</Label>
                <DateTimeField id="entry-when" required value={when} onChange={setWhen} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          {isChecklist ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void submit()}>{stat.kind === "boolean" ? "Mark" : "Log"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
