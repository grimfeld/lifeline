import { Link } from "react-router";
import { useTasks } from "@lifeline/app-tasks";
import { todayStr, type CardOption, type CardProps, type CardSettings } from "@lifeline/core";
import { byRank, nextTaskOf, progressOf } from "../domain/board";
import { projectHref } from "../domain/types";
import { useLanes, useMilestones, useProjects } from "../data/repo";
import { Board } from "../components/Board";
import { Deadline, Face, Progress } from "../components/parts";

/** The open Projects a Card may be pointed at. */
export function useProjectOptions(): CardOption[] {
  return useProjects()
    .filter((p) => p.stage !== "done" && p.stage !== "dropped")
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((p) => ({ value: p.id, label: p.title }));
}

function useProjectTitle(id: unknown): string {
  return useProjects().find((p) => p.id === id)?.title ?? "";
}

/** The Project Card's instance title: its Project's. */
export function useProjectCardTitle(s: CardSettings): string {
  return useProjectTitle(s.project);
}

/** The Project board Card's instance title: "<Project> · Board". */
export function useBoardCardTitle(s: CardSettings): string {
  const t = useProjectTitle(s.project);
  return t ? `${t} · Board` : "";
}

/** Every Active Project: progress, Deadline and next Task — the morning glance. */
export function ActiveProjectsCard() {
  const projects = useProjects().filter((p) => p.stage === "active").sort(byRank);
  const tasks = useTasks();
  const lanes = useLanes();
  const today = todayStr();
  if (projects.length === 0) return <p className="text-muted-foreground p-1 text-sm">No active project.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {projects.map((p) => {
        const next = nextTaskOf(lanes, tasks, p.id, today);
        return (
          <li key={p.id}>
            <Link to={projectHref(p.id)} className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <Face project={p} className="size-5 text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
                <Deadline deadline={p.deadline} />
              </span>
              <Progress {...progressOf(tasks, p.id)} />
              {next && <span className="text-muted-foreground truncate text-xs">Next: {next.title}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** One Project: its Outcome, progress, and its Milestones' progress. */
export function ProjectCard({ settings, configure }: CardProps) {
  const project = useProjects().find((p) => p.id === settings.project);
  const tasks = useTasks();
  const milestones = useMilestones()
    .filter((m) => m.project === settings.project)
    .sort(byRank);
  if (!project)
    return (
      <button className="text-muted-foreground p-1 text-sm underline" onClick={configure}>
        This project is gone — pick another
      </button>
    );
  return (
    <div className="flex flex-col gap-2">
      <Link to={projectHref(project.id)} className="flex items-center gap-2">
        <Face project={project} className="size-6 text-xs" />
        <span className="font-medium">{project.title}</span>
        <Deadline deadline={project.deadline} className="ml-auto" />
      </Link>
      {project.outcome && <p className="text-muted-foreground text-sm">{project.outcome}</p>}
      <Progress {...progressOf(tasks, project.id)} />
      {milestones.map((m) => (
        <div key={m.id} className="flex items-center gap-2 text-sm">
          <span className={m.reachedOn ? "text-muted-foreground line-through" : ""}>⚑ {m.title}</span>
          <Progress {...progressOf(tasks, project.id, m.id)} className="ml-auto w-24" />
        </div>
      ))}
    </div>
  );
}

/** One Project's Board, compact. */
export function BoardCard({ settings, configure }: CardProps) {
  const project = useProjects().find((p) => p.id === settings.project);
  const tasks = useTasks();
  const lanes = useLanes();
  const milestones = useMilestones();
  if (!project)
    return (
      <button className="text-muted-foreground p-1 text-sm underline" onClick={configure}>
        This project is gone — pick another
      </button>
    );
  return <Board project={project} lanes={lanes} tasks={tasks} milestones={milestones} compact />;
}
