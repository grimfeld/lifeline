import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  TagChips,
  toast,
} from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import {
  Archive,
  ArchiveRestore,
  Check,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { Chore } from "../domain/types";
import { dueState, describeSchedule, type DueState } from "../domain/schedule";
import {
  completeChore,
  completionCount,
  deleteChore,
  lastDoneMap,
  setStatus,
  useChores,
  useCompletions,
} from "../data/repo";
import { ChoreDialog } from "../components/ChoreDialog";

interface Row {
  chore: Chore;
  due: DueState;
}

function DueBadge({ due }: { due: DueState }) {
  switch (due.state) {
    case "overdue":
      return (
        <Badge variant="destructive">
          {due.daysLate === 1 ? "1 day late" : `${due.daysLate} days late`}
        </Badge>
      );
    case "due-today":
      return <Badge>Due today</Badge>;
    case "upcoming":
      return <Badge variant="secondary">{formatHuman(due.dueOn)}</Badge>;
    case "not-scheduled":
      return null;
  }
}

function ChoreRow({ row, onEdit }: { row: Row; onEdit: (c: Chore) => void }) {
  const { chore, due } = row;
  const actionable = due.state === "overdue" || due.state === "due-today";
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        {chore.status === "active" && (
          <Button
            size="icon"
            variant={actionable ? "default" : "outline"}
            className="size-8 rounded-full"
            title="Mark done"
            onClick={() => {
              void completeChore(chore.id, todayStr());
              toast.success(`${chore.title} done`);
            }}
          >
            <Check />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{chore.title}</div>
          <div className="text-muted-foreground flex min-w-0 items-center gap-2 text-xs">
            <span className="truncate">{describeSchedule(chore.schedule)}</span>
            <TagChips tags={chore.tags} size="xs" />
          </div>
        </div>
        <DueBadge due={due} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(chore)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            {chore.status === "active" && (
              <DropdownMenuItem onClick={() => void setStatus(chore, "paused")}>
                <Pause /> Pause
              </DropdownMenuItem>
            )}
            {chore.status === "paused" && (
              <DropdownMenuItem onClick={() => void setStatus(chore, "active")}>
                <Play /> Resume
              </DropdownMenuItem>
            )}
            {chore.status !== "archived" ? (
              <DropdownMenuItem onClick={() => void setStatus(chore, "archived")}>
                <Archive /> Archive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => void setStatus(chore, "active")}>
                <ArchiveRestore /> Restore
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void (async () => {
                  if ((await completionCount(chore.id)) > 0) {
                    toast.error("Has history — archive instead");
                    return;
                  }
                  await deleteChore(chore.id);
                  toast.success("Chore deleted");
                })();
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function Section({ title, rows, onEdit }: { title: string; rows: Row[]; onEdit: (c: Chore) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-muted-foreground text-sm font-medium">{title}</h2>
      {rows.map((r) => (
        <ChoreRow key={r.chore.id} row={r} onEdit={onEdit} />
      ))}
    </section>
  );
}

export function ChoresScreen() {
  const chores = useChores();
  const completions = useCompletions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Chore | undefined>();

  const today = todayStr();
  const groups = useMemo(() => {
    const last = lastDoneMap(completions);
    const rows: Row[] = chores.map((chore) => ({
      chore,
      due: dueState(chore, last.get(chore.id) ?? null, today),
    }));
    const active = rows.filter((r) => r.chore.status === "active");
    return {
      overdue: active.filter((r) => r.due.state === "overdue"),
      today: active.filter((r) => r.due.state === "due-today"),
      upcoming: active
        .filter((r) => r.due.state === "upcoming")
        .sort((a, b) =>
          (a.due as { dueOn: string }).dueOn.localeCompare((b.due as { dueOn: string }).dueOn),
        ),
      paused: rows.filter((r) => r.chore.status === "paused"),
      archived: rows.filter((r) => r.chore.status === "archived"),
    };
  }, [chores, completions, today]);

  function edit(c: Chore) {
    setEditing(c);
    setDialogOpen(true);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chores</h1>
        <Button
          onClick={() => {
            setEditing(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus /> New chore
        </Button>
      </div>
      {chores.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            No chores yet. Add the first one.
          </CardContent>
        </Card>
      )}
      <Section title="Overdue" rows={groups.overdue} onEdit={edit} />
      <Section title="Due today" rows={groups.today} onEdit={edit} />
      <Section title="Upcoming" rows={groups.upcoming} onEdit={edit} />
      <Section title="Paused" rows={groups.paused} onEdit={edit} />
      <Section title="Archived" rows={groups.archived} onEdit={edit} />
      <ChoreDialog open={dialogOpen} onOpenChange={setDialogOpen} chore={editing} />
    </div>
  );
}
