import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn, usePhone } from "@lifeline/ui";
import { useTasks, type Task } from "@lifeline/app-tasks";
import { todayStr } from "@lifeline/core";
import { ChevronRight, Columns3, List, Plus } from "lucide-react";
import { byRank, nextTaskOf, progressOf } from "../domain/board";
import { projectHref, STAGES, type Lane, type Project, type Stage } from "../domain/types";
import { useLanes, useProjects } from "../data/repo";
import { ProjectDialog } from "../components/ProjectDialog";
import { useStageMove } from "../components/StageControl";
import { Deadline, Face, Progress, StageBadge } from "../components/parts";

const VIEW_KEY = "projects.home.view";

function readView(): "list" | "board" {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

/**
 * The Projects Module's home (ADR 0060): every Project by stage. As a list —
 * Active ones large, with their next Task; Planned and Paused below; Done
 * and Dropped folded away — or as a board of stages, dragged between them.
 */
export function ProjectsHome() {
  const projects = useProjects();
  const tasks = useTasks();
  const lanes = useLanes();
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "board">(readView);
  const [creating, setCreating] = useState(false);
  const phone = usePhone();

  function choose(v: "list" | "board") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* a remembered view is a convenience */
    }
  }

  const of = (s: Stage) => projects.filter((p) => p.stage === s).sort(byRank);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <div className="ml-auto flex items-center gap-1">
          <PhoneDock order={1}>
            {phone ? (
              <Select value={view} onValueChange={(v) => choose(v as "list" | "board")}>
                <SelectTrigger aria-label="View" className="min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="list">
                    <List /> List
                  </SelectItem>
                  <SelectItem value="board">
                    <Columns3 /> Board
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex rounded-md border p-0.5">
                <Button variant={view === "list" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => choose("list")} aria-pressed={view === "list"}>
                  <List /> List
                </Button>
                <Button variant={view === "board" ? "secondary" : "ghost"} size="sm" className="h-7" onClick={() => choose("board")} aria-pressed={view === "board"}>
                  <Columns3 /> Board
                </Button>
              </div>
            )}
          </PhoneDock>
          <PhoneDock>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus /> Project
            </Button>
          </PhoneDock>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-start gap-2 rounded-lg border border-dashed p-6 text-sm">
          <p>No projects yet. A project is an outcome you can declare finished — "Renovate the bathroom", "Plan the Lisbon trip".</p>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus /> First project
          </Button>
        </div>
      ) : view === "list" ? (
        <ListView of={of} tasks={tasks} lanes={lanes} />
      ) : (
        <StageBoard of={of} tasks={tasks} />
      )}

      <ProjectDialog open={creating} onOpenChange={setCreating} onCreated={(id) => navigate(projectHref(id))} />
    </div>
  );
}

function ListView({ of, tasks, lanes }: { of: (s: Stage) => Project[]; tasks: Task[]; lanes: Lane[] }) {
  const [archive, setArchive] = useState(false);
  const active = of("active");
  const waiting = [...of("planned"), ...of("paused")];
  const ended = [...of("done"), ...of("dropped")].sort((a, b) => (b.endedOn ?? "").localeCompare(a.endedOn ?? ""));
  const today = todayStr();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">Active</h2>
        {active.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing active. Move a planned project to Active when you start on it.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {active.map((p) => (
              <ActiveCard key={p.id} project={p} tasks={tasks} next={nextTaskOf(lanes, tasks, p.id, today)} />
            ))}
          </div>
        )}
      </section>
      {waiting.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-muted-foreground text-sm font-medium">Planned &amp; paused</h2>
          {waiting.map((p) => (
            <Row key={p.id} project={p} tasks={tasks} />
          ))}
        </section>
      )}
      {ended.length > 0 && (
        <section className="flex flex-col gap-1">
          <button className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm font-medium" onClick={() => setArchive((a) => !a)}>
            <ChevronRight className={cn("size-4 transition-transform", archive && "rotate-90")} /> Done &amp; dropped ({ended.length})
          </button>
          {archive && ended.map((p) => <Row key={p.id} project={p} tasks={tasks} />)}
        </section>
      )}
    </div>
  );
}

function ActiveCard({ project, tasks, next }: { project: Project; tasks: Task[]; next?: Task }) {
  const p = progressOf(tasks, project.id);
  return (
    <Link to={projectHref(project.id)} className="hover:border-foreground/30 flex flex-col gap-2 rounded-lg border p-3 transition-colors">
      <div className="flex items-center gap-2">
        <Face project={project} />
        <span className="min-w-0 flex-1 truncate font-medium">{project.title}</span>
        <Deadline deadline={project.deadline} />
      </div>
      {project.outcome && <p className="text-muted-foreground line-clamp-2 text-sm">{project.outcome}</p>}
      <Progress {...p} />
      <div className="text-sm">
        {next ? (
          <span className="flex gap-1">
            <span className="text-muted-foreground shrink-0">Next:</span>
            <span className={cn("truncate", next.date && next.date < todayStr() && "text-destructive")}>{next.title}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">{p.total > 0 && p.done === p.total ? "Every task done — finish it?" : "No open task"}</span>
        )}
      </div>
    </Link>
  );
}

function Row({ project, tasks }: { project: Project; tasks: Task[] }) {
  const p = progressOf(tasks, project.id);
  return (
    <Link to={projectHref(project.id)} className="hover:bg-accent/40 flex items-center gap-3 rounded-md px-2 py-1.5">
      <Face project={project} className="size-6 text-xs" />
      <span className="min-w-0 flex-1 truncate text-sm">{project.title}</span>
      <StageBadge stage={project.stage} />
      {project.stage !== "done" && project.stage !== "dropped" && <Deadline deadline={project.deadline} />}
      <Progress {...p} className="w-28 max-sm:hidden" />
    </Link>
  );
}

/** The Projects themselves on a board of stages — the one Board that crosses Projects. */
function StageBoard({ of, tasks }: { of: (s: Stage) => Project[]; tasks: Task[] }) {
  const { move, dialog } = useStageMove(tasks);
  const [dragging, setDragging] = useState<Project | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STAGES.map((s) => {
          const list = of(s.value);
          return (
            <div
              key={s.value}
              className={cn("bg-muted/40 flex w-60 shrink-0 flex-col rounded-lg border", over === s.value && "ring-primary/50 ring-2")}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(s.value);
              }}
              onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging) void move(dragging, s.value);
                setDragging(null);
              }}
            >
              <div className="flex items-center justify-between border-b px-2 py-1.5">
                <StageBadge stage={s.value} />
                <span className="text-muted-foreground text-xs tabular-nums">{list.length}</span>
              </div>
              <div className="flex min-h-16 flex-col gap-1.5 p-1.5">
                {list.map((p) => (
                  <Link
                    key={p.id}
                    to={projectHref(p.id)}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(p);
                    }}
                    onDragEnd={() => setDragging(null)}
                    className={cn("bg-background flex flex-col gap-1.5 rounded-md border p-2 text-sm shadow-xs", dragging?.id === p.id && "opacity-40")}
                  >
                    <span className="flex items-center gap-2">
                      <Face project={p} className="size-6 text-xs" />
                      <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                    </span>
                    {s.value !== "done" && s.value !== "dropped" && <Deadline deadline={p.deadline} />}
                    <Progress {...progressOf(tasks, p.id)} />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {dialog}
    </>
  );
}
