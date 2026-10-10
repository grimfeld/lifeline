import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Input, PhoneDock, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@lifeline/ui";
import { addDays, todayStr } from "@lifeline/core";
import { Plus } from "lucide-react";
import type { Task } from "../domain/types";
import { deriveItems, type TaskItem } from "../domain/occurrences";
import { addTask, useOverrides, useTasks } from "../data/repo";
import { TaskDialog } from "../components/TaskDialog";
import { MoveDialog, TaskRow } from "../components/TaskRow";

function Section({
  title,
  items,
  onEdit,
  onMove,
  completable,
}: {
  title: string;
  items: TaskItem[];
  onEdit: (t: Task) => void;
  onMove: (i: TaskItem) => void;
  completable?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className="grid min-w-0 grid-cols-1 gap-2">
      <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        {title} <Badge variant="secondary">{items.length}</Badge>
      </h2>
      {items.map((i) => (
        <TaskRow key={i.itemId} item={i} onEdit={onEdit} onMove={onMove} completable={completable} />
      ))}
    </section>
  );
}

function definitionItem(task: Task): TaskItem {
  return {
    itemId: task.id,
    task,
    date: task.date,
    sourceDate: task.date,
    completedOn: task.completedOn,
    recurring: !!task.recurrence,
    moved: false,
    lapsed: false,
  };
}

export function TasksScreen() {
  const tasks = useTasks();
  const overrides = useOverrides();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | undefined>();
  const [moving, setMoving] = useState<TaskItem | null>(null);
  const [quick, setQuick] = useState("");

  const today = todayStr();
  const groups = useMemo(() => {
    const oneTime = tasks.filter((t) => !t.recurrence);
    const items = deriveItems(oneTime, [], { start: "0000-01-01", end: "9999-12-31" }, today);
    const open = items.filter((i) => !i.completedOn);
    const recentDone = deriveItems(tasks, overrides, { start: addDays(today, -30), end: today }, today)
      .filter((i) => i.completedOn)
      .concat(items.filter((i) => i.completedOn && i.date === null))
      .sort((a, b) => (b.completedOn ?? "").localeCompare(a.completedOn ?? ""));
    return {
      overdue: open.filter((i) => i.date !== null && i.date < today),
      today: open.filter((i) => i.date === today),
      unassigned: open.filter((i) => i.date === null),
      upcoming: open.filter((i) => i.date !== null && i.date > today),
      recurring: tasks
        .filter((t) => t.recurrence && t.status === "active")
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(definitionItem),
      done: recentDone,
      archived: tasks
        .filter((t) => t.status === "archived")
        .sort((a, b) => a.title.localeCompare(b.title))
        .map(definitionItem),
    };
  }, [tasks, overrides, today]);

  function edit(t: Task) {
    setEditing(t);
    setDialogOpen(true);
  }

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    await addTask({ title, date: null });
    setQuick("");
    toast.success("Added to Unassigned");
  }

  const openCount =
    groups.overdue.length + groups.today.length + groups.unassigned.length + groups.upcoming.length;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <PhoneDock row className="justify-end">
          <Button
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            <Plus /> New task
          </Button>
        </PhoneDock>
      </div>

      <Input
        placeholder="Quick add — type a task and press Enter (goes to Unassigned)"
        value={quick}
        onChange={(e) => setQuick(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void quickAdd()}
      />

      <Tabs defaultValue="open">
        <PhoneDock row order={1}>
          <TabsList className="max-w-full overflow-x-auto overflow-y-hidden">
            <TabsTrigger value="open">Open ({openCount})</TabsTrigger>
            <TabsTrigger value="recurring">Recurring ({groups.recurring.length})</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
            <TabsTrigger value="archived">Archived ({groups.archived.length})</TabsTrigger>
          </TabsList>
        </PhoneDock>

        <TabsContent value="open" className="grid min-w-0 grid-cols-1 gap-6 pt-4">
          {openCount === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                Nothing open. Add a task above, or plan the week on the Week surface.
              </CardContent>
            </Card>
          )}
          <Section title="Overdue" items={groups.overdue} onEdit={edit} onMove={setMoving} />
          <Section title="Today" items={groups.today} onEdit={edit} onMove={setMoving} />
          <Section title="Unassigned" items={groups.unassigned} onEdit={edit} onMove={setMoving} />
          <Section title="Upcoming" items={groups.upcoming} onEdit={edit} onMove={setMoving} />
        </TabsContent>

        <TabsContent value="recurring" className="grid min-w-0 grid-cols-1 gap-6 pt-4">
          {groups.recurring.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                No recurring tasks. Each Occurrence completes and moves on its own; the rule lives here.
              </CardContent>
            </Card>
          )}
          <Section
            title="Recurring tasks"
            items={groups.recurring}
            onEdit={edit}
            onMove={setMoving}
            completable={false}
          />
        </TabsContent>

        <TabsContent value="done" className="grid min-w-0 grid-cols-1 gap-6 pt-4">
          {groups.done.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                Nothing completed in the last 30 days.
              </CardContent>
            </Card>
          )}
          <Section title="Done" items={groups.done} onEdit={edit} onMove={setMoving} />
        </TabsContent>

        <TabsContent value="archived" className="grid min-w-0 grid-cols-1 gap-6 pt-4">
          {groups.archived.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">
                Archive is empty. Archived tasks are hidden everywhere but kept and restorable.
              </CardContent>
            </Card>
          )}
          <Section title="Archived" items={groups.archived} onEdit={edit} onMove={setMoving} />
        </TabsContent>
      </Tabs>

      <TaskDialog open={dialogOpen} onOpenChange={setDialogOpen} task={editing} />
      <MoveDialog
        item={moving ? { itemId: moving.itemId, title: moving.task.title, date: moving.date } : null}
        onClose={() => setMoving(null)}
      />
    </div>
  );
}
