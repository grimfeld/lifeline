import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { initialText, todayStr, type CommandDialogProps } from "@lifeline/core";
import { Button, DatePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input } from "@lifeline/ui";
import { addMemory } from "../data/repo";
import { memoryHref } from "../domain/types";

/**
 * New memory (ADR 0136): a title and its day, then the Memory opens on its
 * page for the words, photos and what it is about. The palette's "New memory…".
 */
export function NewMemoryDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayStr());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setTitle(initialText(initial, "title"));
    setDate(todayStr());
    setError("");
  }, [open, initial]);

  async function save() {
    if (!title.trim()) return setError("A Memory needs a title.");
    setBusy(true);
    try {
      const m = await addMemory({ title, date });
      onOpenChange(false);
      navigate(memoryHref(m.id));
    } catch (e) {
      setError(`The Memory could not be kept: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New memory</DialogTitle>
          <DialogDescription>A title and its day; the words, photos and what it is about go on its page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Title" error={error}>
            <Input
              value={title}
              autoFocus
              placeholder="Dancing on the terrace"
              onChange={(e) => {
                setTitle(e.target.value);
                setError("");
              }}
            />
          </Field>
          <Field label="Date">
            <DatePicker value={date} required onChange={(d) => setDate(d || todayStr())} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              Keep
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
