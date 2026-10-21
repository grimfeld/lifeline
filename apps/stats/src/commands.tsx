import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { initialText, momentOf, todayStr, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { BarChart3, PenLine, Plus } from "lucide-react";
import { StatEditorDialog } from "./components/StatEditorDialog";
import { AddEntryDialog } from "./components/AddEntryDialog";
import { addEntry, allStats, useEntries, useStats } from "./data/repo";
import { noonOf, normalizeItem } from "./domain/aggregate";
import { colorVar, STAT, type Stat } from "./domain/types";

function NewStatCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <StatEditorDialog {...props} />;
}

function LogEntryCommandDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const stats = useStats();
  const entries = useEntries();
  const [picked, setPicked] = useState<Stat | null>(null);
  // The line names a Stat by id: its form opens straight away, holding the rest of the line.
  const named = initialText(initial, "stat");
  useEffect(() => {
    if (open && named) setPicked((p) => p ?? stats.find((s) => s.id === named) ?? null);
  }, [open, named, stats]);
  if (picked) {
    return (
      <AddEntryDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setPicked(null);
          onOpenChange(o);
        }}
        stat={picked}
        initial={initial}
        entries={entries.filter((e) => e.statId === picked.id)}
      />
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log an entry</DialogTitle>
        </DialogHeader>
        {stats.length === 0 ? (
          <p className="text-muted-foreground text-sm">No stats yet.</p>
        ) : (
          <ul className="grid gap-1">
            {stats.map((s) => (
              <li key={s.id}>
                <Button variant="ghost" className="w-full justify-start" onClick={() => setPicked(s)}>
                  <span className="size-2 rounded-full" style={{ background: colorVar(s.color) }} />
                  {s.title}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const statCommands: CommandDef[] = [
  {
    id: "stats.log",
    title: "Log entry",
    keywords: ["stat", "track", "mark", "notch"],
    icon: PenLine,
    dialog: LogEntryCommandDialog,
    capture: true,
    args: [
      { key: "stat", label: "Stat", kind: "link", linkType: STAT, required: true },
      { key: "value", label: "Value", kind: "number", hint: "A reading or an amount; an additive Stat with a default increment may omit it. Not for yes/no or collection Stats." },
      { key: "item", label: "Item", kind: "text", hint: "Collection Stats only: what was collected. A Collection with preset items expects one of them." },
      { key: "date", label: "Day", kind: "date", hint: "Defaults to now." },
      { key: "time", label: "Time", kind: "time", hint: "With a day; defaults to noon. Ignored for yes/no Stats." },
    ],
    async invoke(a) {
      const stat = (await allStats()).find((s) => s.id === a.stat)!;
      const unit = stat.unit ? ` ${stat.unit}` : "";
      if (stat.kind === "boolean") {
        const day = (a.date as string | undefined) ?? todayStr();
        if (day > todayStr()) throw new Error("That day is still to come");
        await addEntry({ statId: stat.id, value: 1, ts: noonOf(day) });
        return { message: `${stat.title} marked for ${day}` };
      }
      const ts = momentOf(a.date as string | undefined, a.time as string | undefined) ?? new Date().toISOString();
      if (stat.kind === "collection") {
        const typed = (a.item as string | undefined)?.trim();
        if (!typed) throw new Error("Name the item collected");
        // A preset item is logged under the list's spelling, so it ticks on the checklist.
        const item = stat.items.find((i) => normalizeItem(i) === normalizeItem(typed)) ?? typed;
        await addEntry({ statId: stat.id, value: 1, item, ts });
        return { message: `${item} added to ${stat.title}` };
      }
      const value = (a.value as number | undefined) ?? (stat.kind === "additive" && stat.defaultIncrement ? stat.defaultIncrement : undefined);
      if (value === undefined) throw new Error(`${stat.title} needs a value`);
      await addEntry({ statId: stat.id, value, ts });
      return { message: `${stat.title}: ${value}${unit} logged` };
    },
  },
  { id: "stats.new", title: "New stat", keywords: ["stat", "track", "create"], icon: Plus, dialog: NewStatCommandDialog },
  { id: "stats.open", title: "Go to Stats", keywords: ["stats", "graphs"], icon: BarChart3, run: ({ navigate }) => navigate("/app/stats") },
];
