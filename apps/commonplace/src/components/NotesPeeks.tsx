import { useId, useState } from "react";
import { useDocument, type PeekProps } from "@lifeline/core";
import { AliasesField, ChoiceField, DraftText, PeekField, TagsField, savePatch } from "@lifeline/editor";
import { Button, toast } from "@lifeline/ui";
import { Link2Off, NotebookPen } from "lucide-react";
import { useSources } from "../data/works";
import { thoughtFromNote } from "../data/notes";
import { SOURCE_KINDS, type Note, type OwnSource, type Quote } from "../domain/types";
import { CaptureForm, resolveChoice, useCaptureSources } from "./CaptureForm";
import { NEW_SOURCE, SourcePicker, emptyChoice, type SourceChoice } from "./SourcePicker";
import { KeepMenu } from "./KeepMenu";

/**
 * The Notes App's part of a Source's Peek (ADR 0085): what it is — kind, URL,
 * author, when published, what it is part of, other names — its Tags, and the
 * App's one act on a Source, taking a Note or a Quote from it.
 */
export function SourcePeek({ doc }: PeekProps) {
  const s = doc as OwnSource;
  const sources = useSources();
  const [taking, setTaking] = useState(false);
  // Neither itself nor what sits inside it can hold it.
  const parents = sources.filter((x) => x.id !== s.id && x.parent !== s.id).map((x) => ({ value: x.id, label: x.title }));
  const set = (patch: Record<string, unknown>) => void savePatch(s.id, patch);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceField label="Kind" value={s.kind ?? ""} options={SOURCE_KINDS} optional onChange={(kind) => set({ kind })} />
        <DraftText label="Author" value={s.author ?? ""} onCommit={(author) => set({ author })} />
        <DraftText label="URL" type="url" value={s.url ?? ""} onCommit={(url) => set({ url })} />
        <DraftText label="Published" type="date" value={s.publishedOn ?? ""} onCommit={(publishedOn) => set({ publishedOn })} />
      </div>
      <ChoiceField label="Part of" value={s.parent ?? ""} options={parents} optional onChange={(parent) => set({ parent })} />
      <AliasesField doc={doc} />
      <TagsField doc={doc} />
      {taking ? (
        <section className="bg-card rounded-lg border p-3" aria-label="Take a note or a quote">
          <CaptureForm source={s.id} autoFocus onDone={() => setTaking(false)} onCancel={() => setTaking(false)} />
        </section>
      ) : (
        <div>
          <Button size="sm" variant="outline" onClick={() => setTaking(true)}>
            <NotebookPen /> Take a note or a quote
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * The Notes App's part of a Note's Peek (ADR 0085): the Source it is on —
 * picked as the capture form picks it — where in it, other names, its Tags,
 * and the act that takes its Source away (a Thought again, the same Document).
 */
export function NotePeek({ doc }: PeekProps) {
  const note = doc as Note;
  const id = useId();
  const { all, current } = useCaptureSources();
  const [choice, setChoice] = useState<SourceChoice | null>(null);
  const shown = choice ?? { ...emptyChoice, id: note.source ?? "" };
  const pick = (next: SourceChoice) => {
    if (next.id === NEW_SOURCE) return setChoice(next);
    setChoice(null);
    if (next.id && next.id !== note.source) void savePatch(note.id, { source: next.id });
  };
  const makeNew = () =>
    void resolveChoice(shown)
      .then((source) => savePatch(note.id, { source }))
      .then(() => setChoice(null))
      .catch((e: Error) => toast.error(e.message));
  return (
    <div className="grid gap-3">
      <PeekField label="Source" htmlFor={id}>
        <SourcePicker id={id} current={current} all={all} value={shown} onChange={pick} />
        {shown.id === NEW_SOURCE && (
          <div className="flex justify-end">
            <Button size="sm" disabled={!shown.newTitle.trim()} onClick={makeNew}>
              Put it on this new Source
            </Button>
          </div>
        )}
      </PeekField>
      <DraftText label="Where" value={note.locator ?? ""} placeholder="Page, chapter, 34:12" onCommit={(locator) => void savePatch(note.id, { locator })} />
      <AliasesField doc={doc} />
      <TagsField doc={doc} />
      <div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-7 px-1"
          onClick={() =>
            void thoughtFromNote(note.id)
              .then(() => toast.success("A Thought again — no Source"))
              .catch((e: Error) => toast.error(e.message))
          }
        >
          <Link2Off /> Take its Source away
        </Button>
      </div>
    </div>
  );
}

/**
 * The Notes App's part of a Quote's Peek (ADR 0085): the Source it was taken
 * from and when, shown — they are guarded, a Quote is never moved off its
 * Source — where in it and my comment, edited; its Tags; and keeping it in
 * Practice through the App's Keep menu.
 */
export function QuotePeek({ doc }: PeekProps) {
  const q = doc as Quote;
  const source = useDocument(q.source);
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="text-muted-foreground min-w-0 flex-1 [overflow-wrap:anywhere]">
          From {source?.title ?? "a Source no longer here"}
          {q.capturedOn && ` · taken ${q.capturedOn}`}
        </span>
        <KeepMenu quote={q} className="size-7 shrink-0" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <DraftText label="Where" value={q.locator ?? ""} placeholder="Page, chapter, 34:12" onCommit={(locator) => void savePatch(q.id, { locator })} />
        <DraftText label="Comment" value={q.comment ?? ""} placeholder="Your comment" onCommit={(comment) => void savePatch(q.id, { comment })} />
      </div>
      <TagsField doc={doc} />
    </div>
  );
}
