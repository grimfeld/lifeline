import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TagInput, Textarea, toast } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { CATEGORIES, MEASURE_LABEL, MEASURES, type Category, type Exercise, type Measure } from "../domain/types";
import { addExercise, updateExercise } from "../data/repo";

/** An Exercise (ADR 0030): a hand-curated library entry with the one measure worth beating. */
export function ExerciseEditorDialog({
  open,
  onOpenChange,
  exercise,
  initialTitle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  exercise?: Exercise;
  /** New-mode prefill (the name typed into a Movement picker). */
  initialTitle?: string;
  onSaved?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("full-body");
  const [measure, setMeasure] = useState<Measure>("reps");
  const [equipment, setEquipment] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setTitle(exercise?.title ?? initialTitle ?? "");
    setCategory(exercise?.category ?? "full-body");
    setMeasure(exercise?.measure ?? "reps");
    setEquipment(exercise?.equipment ?? "");
    setNotes(exercise?.notes ?? "");
    setTags(exercise?.tags ?? []);
  }, [open, exercise, initialTitle]);

  async function submit() {
    if (!title.trim()) return void toast.error("Name required");
    const input = { title, category, measure, equipment, notes, tags };
    let id: string;
    if (exercise) {
      await updateExercise(exercise, input);
      id = exercise.id;
      toast.success("Exercise updated");
    } else {
      id = await addExercise(input);
      toast.success("Exercise added");
    }
    onSaved?.(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{exercise ? "Edit exercise" : "New exercise"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ex-title">Name</Label>
            <Input id="ex-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Deadlift" autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Measure</Label>
              <Select value={measure} onValueChange={(v) => setMeasure(v as Measure)}>
                <SelectTrigger aria-label="Measure">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEASURES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MEASURE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">The one number a PR is measured in.</p>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ex-equipment">Equipment</Label>
            <Input id="ex-equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Barbell, kettlebell, none…" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ex-notes">Notes</Label>
            <Textarea id="ex-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Cues, form points" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ex-tags">Tags</Label>
            <TagInput id="ex-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{exercise ? "Save" : "Add exercise"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
