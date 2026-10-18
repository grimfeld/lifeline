import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, Textarea, toast } from "@lifeline/ui";
import { useTagVocabulary, type IntakeDialogProps } from "@lifeline/core";
import { Brackets } from "lucide-react";
import { parseCloze } from "../domain/cloze";
import type { Sentence } from "../domain/types";
import { addSentence, deleteItem, updateSentence, useActiveTopic, useTopics } from "../data/repo";
import { TopicSelect } from "./TopicSelect";
import { originOf } from "./WordDialog";
import { OriginLine } from "./OriginLine";

export interface SentencePrefill {
  text?: string;
  origin?: string;
  originId?: string;
}

/** Wrap the selected part of a textarea's value in `{{ }}`. */
function blankSelection(el: HTMLTextAreaElement, value: string): { next: string; caret: number } | null {
  const { selectionStart: a, selectionEnd: b } = el;
  if (a === b) return null;
  const inner = value.slice(a, b);
  const lead = inner.match(/^\s*/)?.[0] ?? "";
  const trail = inner.match(/\s*$/)?.[0] ?? "";
  const word = inner.trim();
  if (!word) return null;
  const next = `${value.slice(0, a)}${lead}{{${word}}}${trail}${value.slice(b)}`;
  return { next, caret: a + lead.length + word.length + 4 };
}

/**
 * New / edit Sentence (CONTEXT.md "Sentence"): the sentence with its blanks
 * marked — select a word and press Blank, or type `{{ }}` — and an optional
 * translation shown with every Prompt so each blank has one answer.
 */
export function SentenceDialog({ open, onOpenChange, sentence, prefill }: { open: boolean; onOpenChange: (open: boolean) => void; sentence?: Sentence; prefill?: SentencePrefill }) {
  const topics = useTopics();
  const active = useActiveTopic();
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const area = useRef<HTMLTextAreaElement>(null);
  const [languageId, setLanguageId] = useState("");
  const [text, setText] = useState("");
  const [translation, setTranslation] = useState("");
  const [origin, setOrigin] = useState("");
  const [originId, setOriginId] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLanguageId(sentence?.languageId ?? active?.id ?? "");
    setText(sentence?.text ?? prefill?.text ?? "");
    setTranslation(sentence?.translation ?? "");
    setOrigin(sentence?.origin ?? prefill?.origin ?? "");
    setOriginId(sentence?.originId ?? prefill?.originId ?? "");
    setTags(sentence?.tags ?? []);
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sentence, prefill]);

  useEffect(() => {
    if (open && !sentence && !languageId && active) setLanguageId(active.id);
  }, [open, sentence, languageId, active]);

  const blanks = useMemo(() => parseCloze(text).filter((p) => p.kind === "blank"), [text]);

  function blank() {
    const el = area.current;
    if (!el) return;
    const r = blankSelection(el, text);
    if (!r) return void toast.message("Select the word to blank out first");
    setText(r.next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.caret, r.caret);
    });
  }

  async function save() {
    const input = { languageId, text, translation, origin, originId, tags };
    try {
      if (sentence) {
        await updateSentence(sentence, input);
        toast.success("Sentence updated");
      } else {
        await addSentence(input);
        toast.success(`Sentence added · ${blanks.length} prompt${blanks.length === 1 ? "" : "s"}`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!sentence) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteItem(sentence.id);
    toast.success("Sentence deleted, with its recalls");
    onOpenChange(false);
  }

  const noTopic = topics.filter((l) => !l.archived).length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{sentence ? "Edit sentence" : "New sentence"}</DialogTitle>
        </DialogHeader>
        {noTopic ? (
          <p className="text-muted-foreground text-sm">Add a topic first, in Knowledge.</p>
        ) : (
          <div className="grid gap-4">
            {!sentence && <TopicSelect topics={topics} value={languageId} onChange={setLanguageId} />}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="st-text">Sentence</Label>
                <Button type="button" size="sm" variant="outline" onMouseDown={(e) => e.preventDefault()} onClick={blank}>
                  <Brackets /> Blank
                </Button>
              </div>
              <Textarea id="st-text" ref={area} rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tengo {{ganas}} de comer" autoFocus />
              <div className="flex min-h-5 flex-wrap items-center gap-1">
                {blanks.length === 0 ? (
                  <span className="text-muted-foreground text-xs">Select a word and press Blank — each blank is one prompt.</span>
                ) : (
                  blanks.map((b) => (
                    <Badge key={b.kind === "blank" ? b.slot : b.text} variant="secondary">
                      {b.text}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="st-translation">Translation</Label>
              <Input id="st-translation" value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="Optional — a translation, or context; shown with every blank" />
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
                <Label htmlFor="st-origin">Where you met it</Label>
                <Input id="st-origin" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Optional" />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Tags</Label>
              <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {sentence ? (
            <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
              {confirmDelete ? "Really delete" : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void save()} disabled={noTopic}>
            {sentence ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Sentence Intake (ADR 0050): the handed text becomes the sentence, blanks marked in the dialog. */
export function SentenceIntakeDialog({ open, onOpenChange, handoff }: IntakeDialogProps) {
  const prefill = useMemo(() => ({ text: (handoff.text.trim() || handoff.title).replace(/\s+/g, " "), origin: originOf(handoff), originId: handoff.originId }), [handoff]);
  return <SentenceDialog open={open} onOpenChange={onOpenChange} prefill={prefill} />;
}
