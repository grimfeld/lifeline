import { useEffect, useState } from "react";
import { useTagVocabulary } from "@lifeline/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  TagInput,
  toast,
} from "@lifeline/ui";
import type { Difficulty, Habit } from "../domain/types";
import { DifficultyField } from "./ActivityFields";
import { addHabit, updateHabit } from "../data/repo";

export function HabitEditorDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (o: boolean) => void; habit?: Habit }) {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(habit?.title ?? "");
    setDifficulty(habit?.difficulty ?? "normal");
    setTags(habit?.tags ?? []);
  }, [open, habit]);

  async function submit() {
    if (!name.trim()) return void toast.error("Name required");
    if (habit) {
      const changed = habit.difficulty !== difficulty;
      await updateHabit(habit, { title: name, difficulty, tags });
      toast.success(changed ? "Habit updated — the whole ledger re-values at the new difficulty" : "Habit updated");
    } else {
      await addHabit({ title: name, difficulty, tags });
      toast.success("Habit created — go earn XP");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* On a phone the dialog is a full-screen sheet: the fields keep their natural height
          (content-start) and the actions ride the bottom of the screen, not the middle. */}
      <DialogContent className="max-md:grid-rows-[auto_1fr_auto] sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{habit ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <div className="grid content-start gap-4">
          <div className="grid gap-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input id="habit-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <DifficultyField id="habit-difficulty" value={difficulty} onChange={setDifficulty} />
          <div className="grid gap-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{habit ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
