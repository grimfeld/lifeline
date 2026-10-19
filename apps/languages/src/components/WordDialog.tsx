import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, Textarea, toast } from "@lifeline/ui";
import { useTagVocabulary, type IntakeDialogProps } from "@lifeline/core";
import type { Word } from "../domain/types";
import { addWord, deleteItem, updateWord, useActiveTopic, useTopics } from "../data/repo";
import { TopicSelect } from "./TopicSelect";
import { OriginLine } from "./OriginLine";

/**
 * A Word, Sentence or Fact dialog: an Intake's dialog without the Handoff, so
 * it opens empty, prefilled or on an item to edit, and reports what it made.
 */
export type ItemDialogProps = Omit<IntakeDialogProps, "handoff">;

export interface WordPrefill {
  term?: string;
  origin?: string;
  originId?: string;
}

/**
 * New / edit Word (CONTEXT.md "Word"): the term, its meaning in the user's
 * own words, notes and where it was met. Quick enough for the capture sheet:
 * term, meaning, Enter.
 */
export function WordDialog({ open, onOpenChange, word, prefill, onSaved }: ItemDialogProps & { word?: Word; prefill?: WordPrefill }) {
  const topics = useTopics();
  const active = useActiveTopic();
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [languageId, setLanguageId] = useState("");
  const [term, setTerm] = useState("");
  const [meaning, setMeaning] = useState("");
  const [notes, setNotes] = useState("");
  const [origin, setOrigin] = useState("");
  const [originId, setOriginId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // What this opening kept: a close after "Save & add another" still tells the caller it saved.
  const kept = useRef("");

  useEffect(() => {
    if (!open) return;
    setLanguageId(word?.languageId ?? active?.id ?? "");
    setTerm(word?.term ?? prefill?.term ?? "");
    setMeaning(word?.meaning ?? "");
    setNotes(word?.notes ?? "");
    setOrigin(word?.origin ?? prefill?.origin ?? "");
    setOriginId(word?.originId ?? prefill?.originId ?? "");
    setTags(word?.tags ?? []);
    setConfirmDelete(false);
    kept.current = "";
    // `active` settles after the first render; a Word's own Topic never moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, word, prefill]);

  useEffect(() => {
    if (open && !word && !languageId && active) setLanguageId(active.id);
  }, [open, word, languageId, active]);

  async function save(another = false) {
    const input = { languageId, term, meaning, notes, origin, originId, tags };
    try {
      if (word) {
        await updateWord(word, input);
        toast.success("Word updated");
      } else {
        kept.current = await addWord(input);
        toast.success(`${term.trim()} added`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    if (another) {
      setTerm("");
      setMeaning("");
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
    if (!word) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteItem(word.id);
    toast.success("Word deleted, with its recalls");
    onOpenChange(false);
  }

  const noTopic = topics.filter((l) => !l.archived).length === 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{word ? "Edit word" : "New word"}</DialogTitle>
        </DialogHeader>
        {noTopic ? (
          <p className="text-muted-foreground text-sm">Add a topic first, in Knowledge.</p>
        ) : (
          <div className="grid gap-4">
            {!word && <TopicSelect topics={topics} value={languageId} onChange={setLanguageId} />}
            <div className="grid gap-2">
              <Label htmlFor="wd-term">Word</Label>
              <Input id="wd-term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="tener ganas de" autoFocus lang="" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wd-meaning">Meaning</Label>
              <Input id="wd-meaning" value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder="to feel like (doing something)" onKeyDown={(e) => e.key === "Enter" && void save()} />
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
                <Label htmlFor="wd-origin">Where you met it</Label>
                <Input id="wd-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Optional — a link, a book, Pedro at dinner" />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="wd-notes">Notes</Label>
              <Textarea id="wd-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {word ? (
            <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
              {confirmDelete ? "Really delete" : "Delete"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void save(true)} disabled={noTopic}>
              Save & add another
            </Button>
          )}
          <Button onClick={() => void save()} disabled={noTopic}>
            {word ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Where a Handoff was met: its URL, else what it was called. */
export function originOf(h: IntakeDialogProps["handoff"]): string {
  return h.url || [h.title, h.author].filter(Boolean).join(" · ");
}

/** The Word Intake (ADR 0050): the handed text becomes the term, its source the origin. */
export function WordIntakeDialog({ open, onOpenChange, handoff, onSaved }: IntakeDialogProps) {
  const prefill = useMemo(() => {
    const text = handoff.text.trim();
    return { term: text && text.length <= 80 ? text : handoff.title, origin: originOf(handoff), originId: handoff.originId };
  }, [handoff]);
  return <WordDialog open={open} onOpenChange={onOpenChange} prefill={prefill} onSaved={onSaved} />;
}
