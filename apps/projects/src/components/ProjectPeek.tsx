import { Link } from "react-router";
import { Button, CommitField } from "@lifeline/ui";
import { useTasks } from "@lifeline/app-tasks";
import { noteTiming, peekTapped, timedTimingKey, todayStr, type DateStr, type Document } from "@lifeline/core";
import { ArrowUpRight } from "lucide-react";
import { byRank, markerId, nextTaskOf, progressOf } from "../domain/board";
import { APP_ID, projectHref, type Project } from "../domain/types";
import { setDeadline, updateProject, useLanes, useMilestones } from "../data/repo";
import { StageControl } from "./StageControl";
import { Deadline, Progress } from "./parts";

/**
 * The Projects App's Peek (ADR 0057, editable by ADR 0085): a Project seen
 * from wherever a link to it was followed — its stage one tap away (moved
 * only through `setStage`, the stage being guarded), its Outcome, start and
 * Deadline edited in place through `updateProject`, its progress, next Task
 * and Milestones, and its page one more tap.
 */
export function ProjectPeek({ doc }: { doc: Document }) {
  const project = doc as Project;
  const tasks = useTasks();
  const lanes = useLanes();
  const milestones = useMilestones().filter((m) => m.project === project.id).sort(byRank);
  const next = nextTaskOf(lanes, tasks, project.id, todayStr());
  // Opened on its Deadline from the hours, this field is the Peek's timing (ADR 0124): a change is
  // noted to the Peek, which leaves one Undo on closing (#536), as the shell's timing section would.
  const tapped = peekTapped();
  const marker = { appId: APP_ID, itemId: markerId(project.id) };
  const openedOnDeadline = tapped?.kind === "timed" && tapped.item.appId === marker.appId && tapped.item.itemId === marker.itemId;
  function commitDeadline(value: string) {
    const deadline: DateStr | null = value || null;
    if (openedOnDeadline) {
      const before = project.deadline ?? null;
      noteTiming({ key: timedTimingKey(marker), label: project.title, before, after: deadline, restore: () => setDeadline(project.id, before) });
    }
    return updateProject(project, { title: project.title, deadline });
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <StageControl project={project} tasks={tasks} />
        {project.stage !== "done" && project.stage !== "dropped" && <Deadline deadline={(project.deadline as string) || null} />}
      </div>
      <CommitField label="Outcome" value={project.outcome ?? ""} placeholder="What finished looks like" onCommit={(outcome) => updateProject(project, { title: project.title, outcome })} />
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Start" type="date" value={project.start ?? ""} onCommit={(start) => updateProject(project, { title: project.title, start: start || null })} />
        <CommitField label="Deadline" type="date" min={project.start ?? undefined} value={project.deadline ?? ""} onCommit={commitDeadline} />
      </div>
      <Progress {...progressOf(tasks, project.id)} />
      {next && (
        <p className="text-sm">
          <span className="text-muted-foreground">Next: </span>
          {next.title}
        </p>
      )}
      {milestones.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2">
              <span className={m.reachedOn ? "text-muted-foreground line-through" : ""}>⚑ {m.title}</span>
              <Progress {...progressOf(tasks, project.id, m.id)} className="ml-auto w-24" />
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button size="sm" variant="outline" asChild>
          <Link to={projectHref(project.id)}>
            <ArrowUpRight /> Open project
          </Link>
        </Button>
      </div>
    </div>
  );
}
