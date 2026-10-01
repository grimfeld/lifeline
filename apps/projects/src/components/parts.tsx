import { cn, colorVar } from "@lifeline/ui";
import { diffDays, todayStr, type DateStr } from "@lifeline/core";
import { faceOf } from "../domain/board";
import { stageLabel, type Project, type Stage } from "../domain/types";

/** The Projects App's own colour — what a faceless Project is painted with. */
export const PROJECTS_COLOR = "var(--chart-violet)";

export function faceColor(p: Pick<Project, "color">): string {
  return p.color ? colorVar(p.color) : PROJECTS_COLOR;
}

/** A Project's face: its emoji or first letter on a disc of its colour. */
export function Face({ project, className }: { project: Pick<Project, "emoji" | "title" | "color">; className?: string }) {
  const emoji = !!project.emoji;
  return (
    <span
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold", emoji ? "text-base" : "text-white", className)}
      style={{ background: emoji ? `color-mix(in oklab, ${faceColor(project)} 22%, transparent)` : faceColor(project) }}
      aria-hidden
    >
      {faceOf(project)}
    </span>
  );
}

const STAGE_TONE: Record<Stage, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-primary/15 text-primary",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  dropped: "bg-muted text-muted-foreground line-through",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STAGE_TONE[stage])}>{stageLabel(stage)}</span>;
}

/** Ticked over all, as a thin bar with the count beside it. Nothing when there is nothing to count. */
export function Progress({ done, total, className }: { done: number; total: number; className?: string }) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-muted h-1.5 min-w-12 flex-1 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {done}/{total}
      </span>
    </div>
  );
}

/** "Due in 3 days", "Due today", "4 days late" — a Deadline read against today. */
export function deadlineText(deadline: DateStr, today: DateStr = todayStr()): { text: string; late: boolean } {
  if (deadline === today) return { text: "Due today", late: false };
  const n = Math.abs(diffDays(deadline, today));
  if (deadline > today) return { text: n === 1 ? "Due tomorrow" : `Due in ${n} days`, late: false };
  return { text: n === 1 ? "1 day late" : `${n} days late`, late: true };
}

export function Deadline({ deadline, className }: { deadline: DateStr | null; className?: string }) {
  if (!deadline) return null;
  const { text, late } = deadlineText(deadline);
  return (
    <span className={cn("text-xs", late ? "text-destructive font-medium" : "text-muted-foreground", className)} title={`Deadline ${deadline}`}>
      ⚑ {text}
    </span>
  );
}

/** Minutes as "3 h 20 min". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
