import { useEffect, useState } from "react";
import { Button, cn, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, toast } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { DEFAULT_DURATION_MIN, durationOf } from "../domain/templates";
import type { BlockerTemplate } from "../domain/types";
import { addBlockerTemplate, updateBlockerTemplate } from "../data/blockerTemplates";
import { BLOCKER_COLORS } from "./TimeBlockerDialog";

/** Common lengths, offered as one click each. */
const PRESET_MIN = [10, 15, 20, 30, 45, 60];

/** A Blocker template (ADR 0029): the shape of a one-off band you drop on the Schedule — title, length, colour. */
export function BlockerTemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  template?: BlockerTemplate;
}) {
  const [title, setTitle] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [color, setColor] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? "");
    setDurationMin(template ? durationOf(template) : 30);
    setColor(template?.color ?? null);
    setTags(template?.tags ?? []);
  }, [open, template]);

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    if (durationMin <= 0) return void toast.error("Length must be more than zero");
    const fields = { title: title.trim(), durationMin, color, tags };
    if (template) {
      await updateBlockerTemplate({ ...template, ...fields });
      toast.success("Blocker template updated");
    } else {
      await addBlockerTemplate(fields);
      toast.success("Blocker template added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? "Edit blocker template" : "New blocker template"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="btpl-title">Title</Label>
            <Input id="btpl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Travel" autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
            <p className="text-muted-foreground text-xs">Drop it on an hour of the Schedule to paint a one-off band there — hours taken, not an event.</p>
          </div>
          <div className="grid gap-2">
            <Label>Length</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_MIN.map((m) => (
                <Button key={m} type="button" size="sm" variant={durationMin === m ? "default" : "outline"} onClick={() => setDurationMin(m)}>
                  {m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60}`}
                </Button>
              ))}
              <Input type="number" min={5} step={5} className="h-8 w-24" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || DEFAULT_DURATION_MIN)} aria-label="Length in minutes" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-1.5">
              {BLOCKER_COLORS.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  aria-label={c.label}
                  aria-pressed={color === c.value}
                  title={c.label}
                  className={cn("size-6 rounded-full border-2", color === c.value ? "border-foreground" : "border-transparent")}
                  style={{ background: c.value ?? "var(--chart-violet)" }}
                  onClick={() => setColor(c.value)}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="btpl-tags">Tags</Label>
            <TagInput id="btpl-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{template ? "Save" : "Add template"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
