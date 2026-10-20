import { useEffect, useState } from "react";
import {
  Button,
  cn,
  DatePicker,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  toast,
} from "@lifeline/ui";
import { setCompleted, TaskDialog, type Task } from "@lifeline/app-tasks";
import { todayStr } from "@lifeline/core";
import { CheckCircle2, Circle, Flag, MoreHorizontal, Plus, Repeat } from "lucide-react";
import { byRank, progressOf } from "../domain/board";
import type { Milestone, Project } from "../domain/types";
import { addMilestone, deleteMilestone, setReached, shiftMilestone, updateMilestone } from "../data/repo";
import { Deadline, Progress } from "./parts";

/**
 * A Project's work by Milestone (ADR 0060): each Milestone in the user's
 * order with its own progress and Tasks, then the Tasks under none. A
 * Milestone is reached when the user says so — ticking its Tasks only shows.
 */
export function Milestones({ project, milestones, tasks }: { project: Project; milestones: Milestone[]; tasks: Task[] }) {
  const own = milestones.filter((m) => m.project === project.id).sort(byRank);
  const projectTasks = tasks.filter((t) => t.project === project.id && t.status !== "archived");
  const loose = projectTasks.filter((t) => !t.milestone || !own.some((m) => m.id === t.milestone));
  const [newTask, setNewTask] = useState<{ milestone: string | null } | null>(null);
  const [editing, setEditing] = useState<Task | undefined>();
  const [editingMilestone, setEditingMilestone] = useState<Milestone | undefined>();
  const [name, setName] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {own.map((m, i) => {
        const p = progressOf(tasks, project.id, m.id);
        return (
          <section key={m.id} className={cn("rounded-lg border", m.reachedOn && "opacity-70")}>
            <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              <button
                aria-label={m.reachedOn ? "Not reached yet" : "Mark reached"}
                title={m.reachedOn ? `Reached ${m.reachedOn}` : "Declare reached"}
                onClick={() => void setReached(m, m.reachedOn ? null : todayStr())}
              >
                <Flag className={cn("size-4", m.reachedOn ? "text-primary fill-current" : "text-muted-foreground")} />
              </button>
              <span className={cn("font-medium", m.reachedOn && "line-through")}>{m.title}</span>
              {!m.reachedOn && <Deadline deadline={m.deadline} />}
              <Progress {...p} className="ml-auto w-32" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7" aria-label="Milestone options">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditingMilestone(m)}>Edit</DropdownMenuItem>
                  <DropdownMenuItem disabled={i === 0} onClick={() => void shiftMilestone(m, -1)}>
                    Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={i === own.length - 1} onClick={() => void shiftMilestone(m, 1)}>
                    Move down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => void deleteMilestone(m.id).then(() => toast.success(`${m.title} deleted — its tasks stay in the project`))}
                  >
                    Delete milestone
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </header>
            <TaskList tasks={projectTasks.filter((t) => t.milestone === m.id)} onOpen={setEditing} onAdd={() => setNewTask({ milestone: m.id })} />
          </section>
        );
      })}

      <section className="rounded-lg border">
        <header className="text-muted-foreground border-b px-3 py-2 text-sm font-medium">{own.length > 0 ? "No milestone" : "Tasks"}</header>
        <TaskList tasks={loose} onOpen={setEditing} onAdd={() => setNewTask({ milestone: null })} />
      </section>

      <div className="flex gap-2">
        <Input
          value={name}
          placeholder="New milestone — e.g. Demolition"
          className="max-w-xs"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              void addMilestone(project.id, name);
              setName("");
            }
          }}
        />
        <Button
          variant="outline"
          disabled={!name.trim()}
          onClick={() => {
            void addMilestone(project.id, name);
            setName("");
          }}
        >
          <Plus /> Milestone
        </Button>
      </div>

      <TaskDialog
        open={!!newTask}
        onOpenChange={(o) => !o && setNewTask(null)}
        defaultDate={null}
        defaultProject={project.id}
        defaultMilestone={newTask?.milestone ?? null}
      />
      <TaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} task={editing} />
      <MilestoneDialog milestone={editingMilestone} onOpenChange={(o) => !o && setEditingMilestone(undefined)} />
    </div>
  );
}

function TaskList({ tasks, onOpen, onAdd }: { tasks: Task[]; onOpen: (t: Task) => void; onAdd: () => void }) {
  // Open first, in day order (undated last), then the ticked ones.
  const sorted = [...tasks].sort(
    (a, b) =>
      Number(!!a.completedOn) - Number(!!b.completedOn) ||
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      a.title.localeCompare(b.title),
  );
  return (
    <ul className="flex flex-col p-1">
      {sorted.map((t) => (
        <li key={t.id} className="hover:bg-accent/40 flex items-center gap-2 rounded px-2 py-1 text-sm">
          {t.recurrence ? (
            <Repeat className="text-muted-foreground size-4 shrink-0" aria-label="Recurring" />
          ) : (
            <button aria-label={t.completedOn ? "Mark not done" : "Mark done"} onClick={() => void setCompleted(t.id, t.completedOn ? null : todayStr())}>
              {t.completedOn ? <CheckCircle2 className="text-primary size-4" /> : <Circle className="text-muted-foreground size-4" />}
            </button>
          )}
          <button className={cn("min-w-0 flex-1 truncate text-left", t.completedOn && "text-muted-foreground line-through")} onClick={() => onOpen(t)}>
            {t.title}
          </button>
          {t.date && !t.completedOn && <span className={cn("text-xs tabular-nums", t.date < todayStr() ? "text-destructive" : "text-muted-foreground")}>{t.date}</span>}
        </li>
      ))}
      <li>
        <button className="text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1 text-xs" onClick={onAdd}>
          <Plus className="size-3.5" /> Add task
        </button>
      </li>
    </ul>
  );
}

function MilestoneDialog({ milestone, onOpenChange }: { milestone?: Milestone; onOpenChange: (o: boolean) => void }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [deadline, setDeadline] = useState("");
  useEffect(() => {
    setTitle(milestone?.title ?? "");
    setStart(milestone?.start ?? "");
    setDeadline(milestone?.deadline ?? "");
  }, [milestone]);

  async function save() {
    if (!milestone || !title.trim()) return;
    await updateMilestone(milestone, { title, start: start || null, deadline: deadline || null });
    onOpenChange(false);
  }

  return (
    <Dialog open={!!milestone} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit milestone</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="ms-title">Name</Label>
            <Input id="ms-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="ms-start">Start</Label>
              <DatePicker id="ms-start" value={start} onChange={setStart} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ms-deadline">Deadline</Label>
              <DatePicker id="ms-deadline" value={deadline} min={start || undefined} onChange={setDeadline} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void save()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
