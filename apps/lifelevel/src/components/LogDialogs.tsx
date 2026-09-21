import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, toast } from "@lifeline/ui";
import type { Habit, Negative } from "../domain/types";
import { completeHabit, deleteCompletion, logNegative, useHabits, useNegatives } from "../data/repo";
import { celebrateCompletion, mournNegative } from "../feedback/feedback";

function nowLocalInput(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function WhenAndNote({ when, setWhen, note, setNote }: { when: string; setWhen: (v: string) => void; note: string; setNote: (v: string) => void }) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="ll-when">When it happened</Label>
        <Input id="ll-when" type="datetime-local" value={when} max={nowLocalInput()} onChange={(e) => setWhen(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="ll-note">Note (optional)</Label>
        <Textarea id="ll-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </>
  );
}

/** Complete a Habit with back-logging: `occurredAt` is when it really happened. */
export function CompleteHabitDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (o: boolean) => void; habit: Habit }) {
  const [when, setWhen] = useState(nowLocalInput());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setWhen(nowLocalInput());
    setNote("");
  }, [open]);

  async function submit() {
    const r = await completeHabit(habit.id, { occurredAt: new Date(when).toISOString(), note });
    if (r)
      celebrateCompletion({
        habitTitle: r.habit.title,
        xpAmount: r.xpAmount,
        previousLevel: r.previousLevel,
        nextLevel: r.nextLevel,
        levelDelta: r.levelDelta,
        onUndo: () => deleteCompletion(r.completionId),
      });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete {habit.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <WhenAndNote when={when} setWhen={setWhen} note={note} setNote={setNote} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Complete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The capture command's dialog: pick a Habit, done — or back-log with a time. */
export function CompleteHabitCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const habits = useHabits();
  const [picked, setPicked] = useState<Habit | null>(null);
  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);
  if (picked) {
    return (
      <CompleteHabitDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setPicked(null);
          onOpenChange(o);
        }}
        habit={picked}
      />
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete habit</DialogTitle>
        </DialogHeader>
        {habits.length === 0 ? (
          <p className="text-muted-foreground text-sm">No habits yet.</p>
        ) : (
          <ul className="grid gap-1">
            {habits.map((h) => (
              <li key={h.id}>
                <Button variant="ghost" className="w-full justify-start" onClick={() => setPicked(h)}>
                  {h.title}
                  <span className="text-muted-foreground ml-auto text-xs">{h.difficulty}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Log a Negative with back-logging. The victim is rolled at submit and persisted. */
export function LogNegativeDialog({ open, onOpenChange, negative }: { open: boolean; onOpenChange: (o: boolean) => void; negative: Negative }) {
  const habits = useHabits();
  const [when, setWhen] = useState(nowLocalInput());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setWhen(nowLocalInput());
    setNote("");
  }, [open]);

  const rivalMissing = !!negative.affectsHabitId && !habits.some((h) => h.id === negative.affectsHabitId);
  const blocked = habits.length === 0 || rivalMissing;
  const rival = habits.find((h) => h.id === negative.affectsHabitId);

  async function submit() {
    const r = await logNegative(negative.id, { occurredAt: new Date(when).toISOString(), note });
    if (r?.ok)
      mournNegative({
        negativeTitle: r.negative.title,
        victimTitle: r.victim.title,
        victimId: r.victim.id,
        damage: r.damage,
        onUndo: () => deleteCompletion(r.completionId),
      });
    else if (r && !r.ok) toast.error(r.reason === "no-habits" ? "No habit to hit — create a habit first" : "Rival habit is gone — re-pair the negative first");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log {negative.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            {blocked
              ? rivalMissing
                ? "Blocked: its rival habit was deleted. Re-pair it (or set it to random) first."
                : "Blocked: there is no habit to hit."
              : negative.affectsHabitId
                ? `This will hit ${rival?.title ?? "its rival"}.`
                : "This will hit a random habit. You don't get to know which until it lands."}
          </p>
          <WhenAndNote when={when} setWhen={setWhen} note={note} setNote={setNote} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={blocked} onClick={() => void submit()}>
            It happened
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The capture command's dialog: pick a Negative, confess, take the hit. */
export function LogNegativeCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const negatives = useNegatives();
  const [picked, setPicked] = useState<Negative | null>(null);
  useEffect(() => {
    if (!open) setPicked(null);
  }, [open]);
  if (picked) {
    return (
      <LogNegativeDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setPicked(null);
          onOpenChange(o);
        }}
        negative={picked}
      />
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log negative</DialogTitle>
        </DialogHeader>
        {negatives.length === 0 ? (
          <p className="text-muted-foreground text-sm">No negative activities yet.</p>
        ) : (
          <ul className="grid gap-1">
            {negatives.map((n) => (
              <li key={n.id}>
                <Button variant="ghost" className="w-full justify-start" onClick={() => setPicked(n)}>
                  {n.title}
                  <span className="text-muted-foreground ml-auto text-xs">{n.gravity}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
