import { useEffect, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { DEFAULT_DURATION_MIN, durationOf } from "../domain/templates";
import type { EventTemplate } from "../domain/types";
import { addEventTemplate, updateEventTemplate } from "../data/templates";

/** Common lengths, offered as one click each. */
const PRESET_MIN = [15, 30, 45, 60, 90, 120];

export function EventTemplateDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  template?: EventTemplate;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [defaultStart, setDefaultStart] = useState("");
  const [durationMin, setDurationMin] = useState(DEFAULT_DURATION_MIN);
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setTitle(template?.title ?? "");
    setNotes(template?.notes ?? "");
    setAllDay(!!template?.allDay);
    setDefaultStart(template?.defaultStart ?? "");
    setDurationMin(template ? durationOf(template) : DEFAULT_DURATION_MIN);
    setTags(template?.tags ?? []);
  }, [open, template]);

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    if (!allDay && durationMin <= 0) return void toast.error("Length must be more than zero");
    const fields = {
      title: title.trim(),
      notes: notes.trim(),
      allDay,
      defaultStart: allDay ? null : defaultStart || null,
      durationMin: allDay ? DEFAULT_DURATION_MIN : durationMin,
      tags,
    };
    if (template) {
      await updateEventTemplate({ ...template, ...fields });
      toast.success("Template updated");
    } else {
      await addEventTemplate(fields);
      toast.success("Template added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{template ? "Edit event template" : "New event template"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tpl-title">Title</Label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Standup"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
            <p className="text-muted-foreground text-xs">Every event quick-added from this template gets this title.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(!!v)} /> All day
          </label>
          {!allDay && (
            <>
              <div className="grid gap-2">
                <Label>Length</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PRESET_MIN.map((m) => (
                    <Button key={m} type="button" size="sm" variant={durationMin === m ? "default" : "outline"} onClick={() => setDurationMin(m)}>
                      {m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60}`}
                    </Button>
                  ))}
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    className="h-8 w-24"
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    aria-label="Length in minutes"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tpl-start">Usual start (optional)</Label>
                <Input id="tpl-start" type="time" className="w-36" value={defaultStart} onChange={(e) => setDefaultStart(e.target.value)} />
                <p className="text-muted-foreground text-xs">
                  Used when you add it without picking a slot — without one it lands as an all-day event. Dropping it on
                  the Schedule always wins.
                </p>
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="tpl-notes">Notes</Label>
            <Textarea id="tpl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-tags">Tags</Label>
            <TagInput id="tpl-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
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
