import { useEffect, useState } from "react";
import type { CommandDialogProps } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { addExchange } from "../data/exchanges";
import { ExchangeForm, blankExchange, draftReady, type ExchangeDraft } from "./ExchangeForm";
import { message } from "./writes";

/** Who the dialog is opened with: `initial.with`, a list of Person ids (a Person's page passes theirs). */
const withOfInitial = (initial: Record<string, unknown> | undefined): string[] => (Array.isArray(initial?.with) ? initial.with.filter((v): v is string => typeof v === "string") : []);

/**
 * Log an exchange (ADR 0131): the Exchange's Form, adding — With, Kind, Day and
 * what was said. The palette's and the capture sheet's "Log an exchange…", and
 * a Person's page's **Log exchange**, which opens it with them in With. Save
 * waits for someone in With; a day to come is said under the Day.
 */
export function LogExchangeDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const [draft, setDraft] = useState<ExchangeDraft>(() => blankExchange());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDraft(blankExchange(withOfInitial(initial)));
  }, [open, initial]);

  async function save() {
    if (!draftReady(draft)) return;
    setBusy(true);
    try {
      const x = await addExchange({ ...draft, body: draft.body.trim() ? draft.body : "" });
      toast.success(`Logged ${x.title}`);
      onOpenChange(false);
    } catch (e) {
      toast.error("The exchange could not be logged.", { description: message(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log an exchange</DialogTitle>
          <DialogDescription>A call, video call, message or letter that happened, and what was said.</DialogDescription>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <ExchangeForm mode="adding" draft={draft} onChange={setDraft} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !draftReady(draft)}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
