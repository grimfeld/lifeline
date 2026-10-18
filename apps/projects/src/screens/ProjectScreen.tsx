import { useState } from "react";
import { Link, useParams } from "react-router";
import { Button, PhoneDock, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { useTasks } from "@lifeline/app-tasks";
import { MarkdownView } from "@lifeline/editor";
import { useLinkIndex, vaultDocPath } from "@lifeline/core";
import { ArrowLeft, NotebookPen, Pencil } from "lucide-react";
import { byRank, progressOf, remainingEstimate } from "../domain/board";
import { PROJECTS_HOME } from "../domain/types";
import { useLanes, useMilestones, useProjects } from "../data/repo";
import { Board } from "../components/Board";
import { Material } from "../components/Material";
import { Milestones } from "../components/Milestones";
import { ProjectDialog } from "../components/ProjectDialog";
import { StageControl } from "../components/StageControl";
import { Deadline, Face, formatMinutes, Progress } from "../components/parts";

/**
 * One Project (ADR 0060): its Outcome at the head, stage, Deadline and
 * progress; then its work two ways — by Milestone, or on its Board — and the
 * material that links to it. The plan, if any, is its body, written in the
 * Vault.
 */
export function ProjectScreen() {
  const { id = "" } = useParams<{ id: string }>();
  const projects = useProjects();
  const tasks = useTasks();
  const milestones = useMilestones();
  const lanes = useLanes();
  const index = useLinkIndex();
  const [editing, setEditing] = useState(false);
  const [milestone, setMilestone] = useState<string | undefined>(undefined);
  const project = projects.find((p) => p.id === id);

  if (!project)
    return (
      <div className="text-muted-foreground p-6 text-sm">
        This project is gone. <Link to={PROJECTS_HOME} className="underline">All projects</Link>
      </div>
    );

  const p = progressOf(tasks, project.id);
  const left = remainingEstimate(tasks, project.id);
  const own = milestones.filter((m) => m.project === project.id).sort(byRank);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 md:p-6">
      <Link to={PROJECTS_HOME} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm">
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Face project={project} className="size-9 text-lg" />
          <h1 className="text-xl font-semibold tracking-tight">{project.title}</h1>
          <StageControl project={project} tasks={tasks} />
          <div className="ml-auto flex gap-1">
            <Button variant="outline" size="sm" asChild>
              <Link to={vaultDocPath(project.id)}>
                <NotebookPen /> Plan
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
          </div>
        </div>
        {project.outcome && <p className="text-base">{project.outcome}</p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {project.stage !== "done" && project.stage !== "dropped" && <Deadline deadline={project.deadline} className="text-sm" />}
          {project.start && <span className="text-muted-foreground text-xs">Starts {project.start}</span>}
          {project.endedOn && <span className="text-muted-foreground text-xs">{project.stage === "done" ? "Finished" : "Dropped"} {project.endedOn}</span>}
          {left > 0 && <span className="text-muted-foreground text-xs">{formatMinutes(left)} estimated left</span>}
          <Progress {...p} className="w-48" />
        </div>
      </header>

      <Tabs defaultValue="work">
        <PhoneDock order={1}>
          <TabsList>
            <TabsTrigger value="work">Milestones</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="material">Material</TabsTrigger>
            {project.body && <TabsTrigger value="plan">Plan</TabsTrigger>}
          </TabsList>
        </PhoneDock>
        <TabsContent value="work" className="pt-2">
          <Milestones project={project} milestones={milestones} tasks={tasks} />
        </TabsContent>
        <TabsContent value="board" className="flex flex-col gap-3 pt-2">
          {own.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <Chip on={milestone === undefined} onClick={() => setMilestone(undefined)}>
                All
              </Chip>
              {own.map((m) => (
                <Chip key={m.id} on={milestone === m.id} onClick={() => setMilestone(m.id)}>
                  {m.title}
                </Chip>
              ))}
            </div>
          )}
          <Board project={project} lanes={lanes} tasks={tasks} milestones={milestones} milestone={milestone} />
        </TabsContent>
        <TabsContent value="material" className="pt-2">
          <Material projectId={project.id} />
        </TabsContent>
        {project.body && (
          <TabsContent value="plan" className="pt-2">
            <MarkdownView body={project.body} index={index} origin={project.id} />
          </TabsContent>
        )}
      </Tabs>

      <ProjectDialog open={editing} onOpenChange={setEditing} project={project} />
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={on ? "bg-accent text-accent-foreground rounded-full border border-transparent px-3 py-1 text-xs font-medium" : "text-muted-foreground rounded-full border px-3 py-1 text-xs"}
    >
      {children}
    </button>
  );
}
