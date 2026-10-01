import { useState } from "react";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  toast,
} from "@lifeline/ui";
import { addTask, placeTask, setCompleted, TaskDialog, type Task } from "@lifeline/app-tasks";
import { todayStr } from "@lifeline/core";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, Circle, MoreHorizontal, Plus } from "lucide-react";
import { boardOf, type Column } from "../domain/board";
import type { Lane, Milestone, Project } from "../domain/types";
import { addLane, deleteLane, dropTask, renameLane, setDoneLane, shiftLane } from "../data/repo";

/**
 * A Project's Board (ADR 0060): its Tasks across its own Lanes, dragged
 * between them. Dropping into the done Lane ticks a Task; out of it, unticks.
 * Hand order in a Lane is priority. On a phone, where there is no dragging,
 * each card's menu moves it a Lane or a place at a time.
 */
export function Board({
  project,
  lanes,
  tasks,
  milestones,
  milestone,
  compact = false,
}: {
  project: Project;
  lanes: Lane[];
  tasks: Task[];
  milestones: Milestone[];
  /** Narrow to one Milestone (null = Tasks under none); undefined = all. */
  milestone?: string | null;
  compact?: boolean;
}) {
  const columns = boardOf(lanes, tasks, project.id, milestone);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<{ lane: string; index: number } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [editing, setEditing] = useState<Task | undefined>();
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const milestoneName = new Map(milestones.map((m) => [m.id, m.title]));

  async function drop(col: Column, index: number) {
    const task = dragging ? byId.get(dragging) : undefined;
    setDragging(null);
    setOver(null);
    if (task) await dropTask(task, col.lane, col.tasks, index).catch((e) => toast.error(String(e)));
  }

  async function step(task: Task, col: number, dir: -1 | 1) {
    const to = columns[col + dir];
    if (to) await dropTask(task, to.lane, to.tasks, to.tasks.length);
  }

  async function nudge(task: Task, col: Column, dir: -1 | 1) {
    const i = col.tasks.findIndex((t) => t.id === task.id);
    await dropTask(task, col.lane, col.tasks, i + dir);
  }

  if (columns.length === 0) return <p className="text-muted-foreground text-sm">This project has no lanes.</p>;

  return (
    <>
      <div className={cn("flex gap-3 overflow-x-auto pb-2", compact && "gap-2")}>
        {columns.map((col, ci) => (
          <div
            key={col.lane.id}
            className={cn("bg-muted/40 flex w-64 shrink-0 flex-col rounded-lg border", compact && "w-48", over?.lane === col.lane.id && "ring-primary/50 ring-2")}
            onDragOver={(e) => {
              if (!dragging) return;
              e.preventDefault();
              if (over?.lane !== col.lane.id) setOver({ lane: col.lane.id, index: col.tasks.length });
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void drop(col, over?.lane === col.lane.id ? over.index : col.tasks.length);
            }}
          >
            <LaneHeader project={project} lane={col.lane} count={col.tasks.length} first={ci === 0} last={ci === columns.length - 1} compact={compact} />
            <div className="flex min-h-12 flex-col gap-1.5 p-1.5">
              {col.tasks.map((t, ti) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", t.id);
                    setDragging(t.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  onDragOver={(e) => {
                    if (!dragging) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const r = e.currentTarget.getBoundingClientRect();
                    const index = e.clientY < r.top + r.height / 2 ? ti : ti + 1;
                    if (over?.lane !== col.lane.id || over.index !== index) setOver({ lane: col.lane.id, index });
                  }}
                  className={cn(
                    "bg-background group flex cursor-grab items-start gap-2 rounded-md border px-2 py-1.5 text-sm shadow-xs active:cursor-grabbing",
                    dragging === t.id && "opacity-40",
                    over?.lane === col.lane.id && over.index === ti && dragging !== t.id && "border-t-primary border-t-2",
                  )}
                >
                  <button
                    className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0"
                    aria-label={t.completedOn ? "Mark not done" : "Mark done"}
                    onClick={() => void setCompleted(t.id, t.completedOn ? null : todayStr())}
                  >
                    {t.completedOn ? <CheckCircle2 className="text-primary size-4" /> : <Circle className="size-4" />}
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(t)}>
                    <span className={cn("block break-words", t.completedOn && "text-muted-foreground line-through")}>{t.title}</span>
                    {!compact && (t.milestone || t.date) && (
                      <span className="text-muted-foreground block truncate text-xs">
                        {t.milestone && milestoneName.get(t.milestone)}
                        {t.milestone && t.date && " · "}
                        {t.date && <span className={cn(!t.completedOn && t.date < todayStr() && "text-destructive")}>{t.date}</span>}
                      </span>
                    )}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground shrink-0 opacity-60 group-hover:opacity-100" aria-label="Move">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={ci === 0} onClick={() => void step(t, ci, -1)}>
                        <ArrowLeft /> To {columns[ci - 1]?.lane.title ?? "—"}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={ci === columns.length - 1} onClick={() => void step(t, ci, 1)}>
                        <ArrowRight /> To {columns[ci + 1]?.lane.title ?? "—"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={ti === 0} onClick={() => void nudge(t, col, -1)}>
                        <ArrowUp /> Up
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={ti === col.tasks.length - 1} onClick={() => void nudge(t, col, 1)}>
                        <ArrowDown /> Down
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              {!compact &&
                (adding === col.lane.id ? (
                  <QuickTask project={project} lane={col} milestone={milestone ?? null} onDone={() => setAdding(null)} />
                ) : (
                  !col.lane.done && (
                    <button className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded px-1 py-1 text-xs" onClick={() => setAdding(col.lane.id)}>
                      <Plus className="size-3.5" /> Add task
                    </button>
                  )
                ))}
            </div>
          </div>
        ))}
        {!compact && <AddLane projectId={project.id} />}
      </div>
      <TaskDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} task={editing} />
    </>
  );
}

/** Type a title, hit Enter: a new Task at the bottom of this Lane. */
function QuickTask({ project, lane, milestone, onDone }: { project: Project; lane: Column; milestone: string | null; onDone: () => void }) {
  const [title, setTitle] = useState("");
  async function add() {
    if (!title.trim()) return onDone();
    const id = await addTask({ title: title.trim(), date: null, project: project.id, milestone, lane: lane.lane.id });
    await placeTask(id, lane.lane.id, (lane.tasks.length + 1) * 1000);
    setTitle("");
  }
  return (
    <Input
      autoFocus
      value={title}
      placeholder="Task title, Enter"
      className="h-8 text-sm"
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void add();
        if (e.key === "Escape") onDone();
      }}
      onBlur={() => !title.trim() && onDone()}
    />
  );
}

function LaneHeader({ project, lane, count, first, last, compact }: { project: Project; lane: Lane; count: number; first: boolean; last: boolean; compact: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(lane.title);
  return (
    <div className="flex items-center gap-1 border-b px-2 py-1.5">
      {renaming ? (
        <Input
          autoFocus
          value={name}
          className="h-7 text-sm"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            void renameLane(lane, name);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setRenaming(false);
          }}
        />
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {lane.title}
          {lane.done && <Check className="text-primary ml-1 inline size-3.5" aria-label="Done lane" />}
        </span>
      )}
      <span className="text-muted-foreground text-xs tabular-nums">{count}</span>
      {!compact && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6" aria-label="Lane options">
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => {
                setName(lane.title);
                setRenaming(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void setDoneLane(project.id, lane.done ? null : lane.id)}>
              {lane.done ? "No longer the done lane" : "Make it the done lane"}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={first} onClick={() => void shiftLane(lane, -1)}>
              Move left
            </DropdownMenuItem>
            <DropdownMenuItem disabled={last} onClick={() => void shiftLane(lane, 1)}>
              Move right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() =>
                void deleteLane(lane)
                  .then(() => toast.success(`${lane.title} deleted — its tasks moved to the first lane`))
                  .catch((e: Error) => toast.error(e.message))
              }
            >
              Delete lane
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function AddLane({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  if (!open)
    return (
      <button className="text-muted-foreground hover:text-foreground flex h-10 w-40 shrink-0 items-center justify-center gap-1 rounded-lg border border-dashed text-sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Lane
      </button>
    );
  return (
    <div className="w-48 shrink-0">
      <Input
        autoFocus
        value={name}
        placeholder="Lane name, Enter"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            void addLane(projectId, name);
            setName("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => setOpen(false)}
      />
    </div>
  );
}
