import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { documentsOf, useLiveQuery, type Document } from "@lifeline/core";
import { PROJECT, PROJECT_MILESTONE } from "../domain/types";

/*
 * The controls a Task's day and place in a Project are set with — shared by the
 * Task dialog and the Task's Peek (ADR 0085), so both edit them the same way.
 */

const NONE = "__none";

/**
 * The Projects a Task may be put in, read from the Projects App's Documents
 * (ADR 0060): the open ones, plus whichever the Task already stands in. With
 * the chosen one's Milestones, in their order.
 */
function useProjectChoices(current: string | null, project: string | null) {
  const projects = useLiveQuery(() => documentsOf<Document>(PROJECT), [], [] as Document[]);
  const milestones = useLiveQuery(() => documentsOf<Document>(PROJECT_MILESTONE), [], [] as Document[]);
  const open = projects
    .filter((p) => p.id === current || (p.stage !== "done" && p.stage !== "dropped"))
    .sort((a, b) => a.title.localeCompare(b.title));
  const ofProject = milestones
    .filter((m) => project && m.project === project)
    .sort((a, b) => Number(a.rank ?? 0) - Number(b.rank ?? 0));
  return { projects: open, milestones: ofProject };
}

/** A one-time Task's day, or the Unassigned pool (""). */
export function DayPicker({ id, value, onChange }: { id: string; value: string; onChange: (date: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Day</Label>
      <div className="flex gap-2">
        <Input id={id} type="date" className="min-w-0" value={value} onChange={(e) => onChange(e.target.value)} />
        <Button type="button" className="shrink-0" variant={value ? "outline" : "secondary"} onClick={() => onChange("")}>
          Unassigned
        </Button>
      </div>
      {!value && <p className="text-muted-foreground text-xs">Stays in the Unassigned pool until you drop it on a day.</p>}
    </div>
  );
}

/**
 * The Project a Task stands in, and its Milestone there. Hidden while there is
 * no Project to choose. Choosing another Project clears the Milestone.
 */
export function ProjectPicker({
  current,
  project,
  milestone,
  onChange,
}: {
  /** The Project the saved Task stands in, offered even when it is closed. */
  current: string | null;
  project: string | null;
  milestone: string | null;
  onChange: (project: string | null, milestone: string | null) => void;
}) {
  const choices = useProjectChoices(current, project);
  if (choices.projects.length === 0 && !project) return null;
  return (
    <div className="grid gap-2">
      <Label>Project</Label>
      <div className="flex gap-2">
        <Select
          value={project ?? NONE}
          onValueChange={(v) => {
            const next = v === NONE ? null : v;
            onChange(next, next === project ? milestone : null);
          }}
        >
          <SelectTrigger className="min-w-0 flex-1" aria-label="Project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No project</SelectItem>
            {choices.projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.emoji ? `${String(p.emoji)} ` : ""}
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {project && choices.milestones.length > 0 && (
          <Select value={milestone ?? NONE} onValueChange={(v) => onChange(project, v === NONE ? null : v)}>
            <SelectTrigger className="min-w-0 flex-1" aria-label="Milestone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No milestone</SelectItem>
              {choices.milestones.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
