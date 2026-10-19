import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, Textarea, toast } from "@lifeline/ui";
import { useTagVocabulary, type IntakeDialogProps } from "@lifeline/core";
import type { Fact } from "../domain/types";
import { addFact, deleteItem, updateFact, useActiveTopic, useTopics } from "../data/repo";
import { TopicSelect } from "./TopicSelect";
import { OriginLine } from "./OriginLine";
import { originOf, type ItemDialogProps } from "./WordDialog";

export interface FactPrefill {
  /** The passage it is being kept from — shown beside the form, never put in as the answer. */
  context?: string;
  origin?: string;
  originId?: string;
}

/**
 * New / edit Fact (CONTEXT.md "Fact"): a question and its answer, both
 * written by the user — writing it is part of keeping it, so nothing here is
 * ever filled in for them. Made from a selection, the passage stays in view
 * while they write, and "add another" keeps it for the next Fact.
 */
export function FactDialog({ open, onOpenChange, fact, prefill, onSaved }: ItemDialogProps & { fact?: Fact; prefill?: FactPrefill }) {
  const topics = useTopics();
  const active = useActiveTopic();
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [languageId, setLanguageId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [notes, setNotes] = useState("");
  const [origin, setOrigin] = useState("");
  const [originId, setOriginId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // What this opening kept: a close after "Save & add another" still tells the caller it saved.
  const kept = useRef("");

  useEffect(() => {
    if (!open) return;
    setLanguageId(fact?.languageId ?? active?.id ?? "");
    setQuestion(fact?.question ?? "");
    setAnswer(fact?.answer ?? "");
    setNotes(fact?.notes ?? "");
    setOrigin(fact?.origin ?? prefill?.origin ?? "");
    setOriginId(fact?.originId ?? prefill?.originId ?? "");
    setTags(fact?.tags ?? []);
    setConfirmDelete(false);
    kept.current = "";
    // `active` settles after the first render; a Fact's own Topic never moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fact, prefill]);

  useEffect(() => {
    if (open && !fact && !languageId && active) setLanguageId(active.id);
  }, [open, fact, languageId, active]);

  async function save(another = false) {
    const input = { languageId, question, answer, notes, origin, originId, tags };
    try {
      if (fact) {
        await updateFact(fact, input);
        toast.success("Fact updated");
      } else {
        kept.current = await addFact(input);
        toast.success("Fact kept");
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    if (another) {
      setQuestion("");
      setAnswer("");
      setNotes("");
      return;
    }
    close(false);
  }

  function close(o: boolean) {
    if (!o && kept.current) onSaved?.(kept.current);
    onOpenChange(o);
  }

  async function remove() {
    if (!fact) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteItem(fact.id);
    toast.success("Fact deleted, with its recalls");
    onOpenChange(false);
  }

  const noTopic = topics.filter((l) => !l.archived).length === 0;
  const context = prefill?.context?.trim();

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fact ? "Edit fact" : "New fact"}</DialogTitle>
        </DialogHeader>
        {noTopic ? (
          <p className="text-muted-foreground text-sm">Add a topic first, in Knowledge.</p>
        ) : (
          <div className="grid gap-4">
            {context && (
              <blockquote className="text-muted-foreground max-h-40 overflow-y-auto border-l-2 pl-3 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]" aria-label="The passage you selected">
                {context}
              </blockquote>
            )}
            {!fact && <TopicSelect topics={topics} value={languageId} onChange={setLanguageId} />}
            <div className="grid gap-2">
              <Label htmlFor="fc-question">Question</Label>
              <Textarea id="fc-question" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="When was the Peace of Westphalia?" autoFocus />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fc-answer">Answer</Label>
              <Textarea id="fc-answer" rows={2} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="1648" />
            </div>
            {originId ? (
              <div className="flex min-w-0 items-center gap-2">
                <OriginLine originId={originId} origin={origin} className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => setOriginId("")} title="Keep it without this link">
                  Unlink
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="fc-origin">Where you met it</Label>
                <Input id="fc-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Optional — a book, a lecture, a link" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="fc-notes">Notes</Label>
              <Textarea id="fc-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional — shown with the answer" />
            </div>
            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {fact ? (
            <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
              {confirmDelete ? "Really delete" : "Delete"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void save(true)} disabled={noTopic}>
              Save & add another
            </Button>
          )}
          <Button onClick={() => void save()} disabled={noTopic}>
            {fact ? "Save" : "Keep"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Fact Intake (ADR 0050, ADR 0073): the handed text is shown as the
 * passage it is kept from and its Document kept as the origin — the question
 * and answer are left for the user to write.
 */
export function FactIntakeDialog({ open, onOpenChange, handoff, onSaved }: IntakeDialogProps) {
  const prefill = useMemo(() => ({ context: handoff.text.trim() || handoff.title, origin: originOf(handoff), originId: handoff.originId }), [handoff]);
  return <FactDialog open={open} onOpenChange={onOpenChange} prefill={prefill} onSaved={onSaved} />;
}
