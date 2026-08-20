import { useState } from "react";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import type { CommandDef } from "@lifeline/core";
import { BarChart3, PenLine, Plus } from "lucide-react";
import { StatEditorDialog } from "./components/StatEditorDialog";
import { AddEntryDialog } from "./components/AddEntryDialog";
import { useEntries, useStats } from "./data/repo";
import { colorVar, type Stat } from "./domain/types";

function NewStatCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <StatEditorDialog {...props} />;
}

function LogEntryCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const stats = useStats();
  const entries = useEntries();
  const [picked, setPicked] = useState<Stat | null>(null);
  if (picked) {
    return (
      <AddEntryDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setPicked(null);
          onOpenChange(o);
        }}
        stat={picked}
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
  { id: "stats.log", title: "Log entry", keywords: ["stat", "track", "mark", "notch"], icon: PenLine, dialog: LogEntryCommandDialog },
  { id: "stats.new", title: "New stat", keywords: ["stat", "track", "create"], icon: Plus, dialog: NewStatCommandDialog },
  { id: "stats.open", title: "Go to Stats", keywords: ["stats", "graphs"], icon: BarChart3, run: ({ navigate }) => navigate("/app/stats") },
];
