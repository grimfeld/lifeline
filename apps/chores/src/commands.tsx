import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
} from "@lifeline/ui";
import { todayStr } from "@lifeline/core";
import type { CommandDef } from "@lifeline/core";
import { Check, ClipboardCheck, Plus } from "lucide-react";
import { ChoreDialog } from "./components/ChoreDialog";
import { addChore, completeChore, lastDoneMap, useChores, useCompletions } from "./data/repo";
import { readSchedule, SCHEDULE_HINT } from "./domain/readSchedule";
import { describeSchedule } from "./domain/schedule";
import { dueState } from "./domain/schedule";

function AddChoreCommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return <ChoreDialog open={open} onOpenChange={onOpenChange} />;
}

function CompleteChoreCommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const chores = useChores();
  const completions = useCompletions();
  const [done, setDone] = useState<string[]>([]);
  const today = todayStr();
  const last = lastDoneMap(completions);

  const due = chores
    .filter((c) => c.status === "active")
    .map((c) => ({ chore: c, due: dueState(c, last.get(c.id) ?? null, today) }))
    .filter((r) => r.due.state === "overdue" || r.due.state === "due-today");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete a chore</DialogTitle>
        </DialogHeader>
        {due.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing due. Enjoy it.</p>
        ) : (
          <ul className="grid gap-1">
            {due.map(({ chore }) => (
              <li key={chore.id}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={done.includes(chore.id)}
                  onClick={() => {
                    setDone((d) => [...d, chore.id]);
                    void completeChore(chore.id, today).then((recorded) => {
                      if (recorded) toast.success(`${chore.title} done`);
                    });
                  }}
                >
                  <Check className={done.includes(chore.id) ? "" : "opacity-30"} />
                  {chore.title}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const choreCommands: CommandDef[] = [
  {
    id: "chores.add",
    title: "Add chore",
    keywords: ["new", "create", "chore"],
    icon: Plus,
    dialog: AddChoreCommandDialog,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "schedule", label: "Schedule", kind: "json", required: true, hint: SCHEDULE_HINT },
      { key: "anchorDate", label: "First due", kind: "date", hint: "Interval chores only: the day the first cycle is due. Defaults to today." },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const schedule = readSchedule(a.schedule);
      await addChore({
        title: a.title as string,
        schedule,
        anchorDate: schedule.kind === "interval" ? ((a.anchorDate as string | undefined) ?? todayStr()) : null,
        tags: (a.tags as string[] | undefined) ?? [],
      });
      return { message: `Added chore “${a.title}” (${describeSchedule(schedule)})` };
    },
  },
  {
    id: "chores.complete",
    title: "Complete a chore",
    keywords: ["done", "tick", "finish"],
    icon: ClipboardCheck,
    dialog: CompleteChoreCommandDialog,
  },
];
