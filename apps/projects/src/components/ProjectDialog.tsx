import { useEffect, useState } from "react";
import {
  Button,
  COLOR_SLOTS,
  cn,
  colorVar,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagInput,
  toast,
} from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { STAGES, type Project, type Stage } from "../domain/types";
import { addProject, deleteProject, updateProject } from "../data/repo";
import { Face } from "./parts";

const EMOJI_PRESETS = ["🏠", "🛠️", "✈️", "💻", "📚", "🎨", "🌱", "💪", "🎉", "📦", "🚗", "💼"];

/** One grapheme — the first of whatever was typed — or "". */
function firstGrapheme(s: string): string {
  const t = s.trim();
  if (!t) return "";
  // Older engines (Firefox before 125) have no Segmenter, whatever the lib's types say.
  const Seg = typeof Intl.Segmenter === "function" ? Intl.Segmenter : undefined;
  if (Seg) for (const g of new Seg(undefined, { granularity: "grapheme" }).segment(t)) return g.segment;
  return Array.from(t)[0] ?? "";
}

/**
 * New / edit Project (ADR 0060): its name, the Outcome — one line saying what
 * finished looks like — its face, start and Deadline, Tags. A new one picks
 * its stage; an existing one moves stage from its page, where finishing asks
 * what becomes of the open Tasks. Deleting releases its Tasks.
 */
export function ProjectDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  project?: Project;
  onCreated?: (id: string) => void;
}) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const [stage, setStage] = useState<Stage>("active");
  const [start, setStart] = useState("");
  const [deadline, setDeadline] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(project?.title ?? "");
    setOutcome(project?.outcome ?? "");
    setStage(project?.stage ?? "active");
    setStart(project?.start ?? "");
    setDeadline(project?.deadline ?? "");
    setEmoji(project?.emoji ?? "");
    setColor(project?.color ?? "");
    setTags(project?.tags ?? []);
    setConfirmDelete(false);
  }, [open, project]);

  async function submit() {
    if (!title.trim()) {
      toast.error("Name required");
      return;
    }
    if (start && deadline && deadline < start) {
      toast.error("The deadline comes before the start");
      return;
    }
    const input = { title, outcome, start: start || null, deadline: deadline || null, emoji, color, tags };
    if (project) {
      await updateProject(project, input);
      toast.success("Project updated");
    } else {
      const id = await addProject({ ...input, stage });
      toast.success("Project created");
      onCreated?.(id);
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!project) return;
    await deleteProject(project.id);
    toast.success(`${project.title} deleted — its tasks are kept as loose tasks`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>An outcome you can declare finished.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-end gap-3">
            <Face project={{ title: title || "?", emoji, color }} className="size-9" />
            <div className="grid flex-1 gap-2">
              <Label htmlFor="project-title">Name</Label>
              <Input id="project-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Renovate the bathroom" autoFocus />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-outcome">Outcome</Label>
            <Input
              id="project-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="What does finished look like?"
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          {!project && (
            <div className="grid gap-2">
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.filter((s) => s.value === "planned" || s.value === "active").map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="project-start">Start</Label>
              <DatePicker id="project-start" value={start} onChange={setStart} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="project-deadline">Deadline</Label>
              <DatePicker id="project-deadline" value={deadline} min={start || undefined} onChange={setDeadline} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-emoji">Face</Label>
            <Input id="project-emoji" value={emoji} onChange={(e) => setEmoji(firstGrapheme(e.target.value))} placeholder="An emoji — or the name's first letter" />
            <div className="flex flex-wrap gap-1">
              {EMOJI_PRESETS.map((e) => (
                <button key={e} type="button" aria-label={e} aria-pressed={emoji === e} onClick={() => setEmoji(emoji === e ? "" : e)} className={cn("hover:bg-accent size-8 rounded-md text-lg leading-none", emoji === e && "bg-accent ring-foreground/40 ring-1")}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-label="No colour" aria-pressed={color === ""} onClick={() => setColor("")} className={cn("text-muted-foreground size-7 rounded-full border-2 border-dashed text-xs transition-transform", color === "" ? "border-foreground scale-110" : "border-muted-foreground/50")} />
              {COLOR_SLOTS.map((c) => (
                <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("size-7 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ background: colorVar(c) }} />
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-tags">Tags</Label>
            <TagInput id="project-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </div>
        </div>
        <DialogFooter>
          {project &&
            (confirmDelete ? (
              <Button variant="destructive" className="sm:mr-auto" onClick={() => void remove()}>
                Delete — keep its tasks
              </Button>
            ) : (
              <Button variant="ghost" className="text-destructive sm:mr-auto" onClick={() => setConfirmDelete(true)} title="Dropping is how a project is let go; delete is for mistakes">
                Delete
              </Button>
            ))}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{project ? "Save" : "Create project"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
