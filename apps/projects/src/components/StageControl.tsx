import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@lifeline/ui";
import { type Task } from "@lifeline/app-tasks";
import { ChevronDown } from "lucide-react";
import { boardTasks } from "../domain/board";
import { STAGES, stageLabel, type Project, type Stage } from "../domain/types";
import { setStage, settleOpenTasks } from "../data/repo";
import { StageBadge } from "./parts";

/**
 * Moving a Project through its stages — by hand only (ADR 0060). Finishing or
 * dropping one with Tasks still open asks what becomes of them: left open
 * where they stand, archived, or taken out of the Project as loose Tasks.
 * Never deleted. Returns the move and the dialog that asks.
 */
export function useStageMove(tasks: Task[]) {
  const [ending, setEnding] = useState<{ project: Project; stage: Stage; open: Task[] } | null>(null);

  async function move(project: Project, stage: Stage) {
    if (project.stage === stage) return;
    const open = boardTasks(tasks, project.id).filter((t) => !t.completedOn);
    if ((stage === "done" || stage === "dropped") && open.length > 0) {
      setEnding({ project, stage, open });
      return;
    }
    await setStage(project.id, stage);
    toast.success(stage === "done" ? `${project.title} finished` : `${project.title} → ${stageLabel(stage)}`);
  }

  async function end(withTasks: "leave" | "archive" | "unlink") {
    if (!ending) return;
    const { project, stage, open } = ending;
    await settleOpenTasks(open, withTasks === "unlink" ? "loose" : withTasks);
    await setStage(project.id, stage);
    toast.success(stage === "done" ? `${project.title} finished` : `${project.title} dropped`);
    setEnding(null);
  }

  const n = ending?.open.length ?? 0;
  const them = n === 1 ? "it" : "them";
  const dialog = (
    <Dialog open={!!ending} onOpenChange={(o) => !o && setEnding(null)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {ending?.stage === "done" ? "Finish" : "Drop"} {ending?.project.title}?
          </DialogTitle>
          <DialogDescription>
            {n} task{n === 1 ? " is" : "s are"} still open. What becomes of {them}?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={() => void end("leave")}>
            Leave {them} open
          </Button>
          <Button variant="outline" onClick={() => void end("archive")}>
            Archive {them}
          </Button>
          <Button variant="outline" onClick={() => void end("unlink")}>
            Keep as loose task{n === 1 ? "" : "s"}
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEnding(null)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { move, dialog };
}

/** A Project's stage as a badge that opens the moves. */
export function StageControl({ project, tasks }: { project: Project; tasks: Task[] }) {
  const { move, dialog } = useStageMove(tasks);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-0.5 rounded-full" aria-label="Change stage">
            <StageBadge stage={project.stage} />
            <ChevronDown className="text-muted-foreground size-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {STAGES.filter((s) => s.value !== project.stage).map((s) => (
            <DropdownMenuItem key={s.value} onClick={() => void move(project, s.value)}>
              {s.value === "done" ? "Finish" : s.value === "dropped" ? "Drop" : `Move to ${s.label}`}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  );
}
