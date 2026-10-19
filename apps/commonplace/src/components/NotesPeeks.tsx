import { useState } from "react";
import { patchDocument, useDocument, type PeekProps } from "@lifeline/core";
import { AliasesField, TagsField } from "@lifeline/editor";
import { Button, ChoiceField, CommitField, Field, toast } from "@lifeline/ui";
import { Link2Off, NotebookPen } from "lucide-react";
import { useSources } from "../data/works";
import { thoughtFromNote } from "../data/notes";
import { SOURCE_KINDS, type Note, type OwnSource, type Quote } from "../domain/types";
import { CaptureForm, resolveChoice, useCaptureSources } from "./CaptureForm";
import { NEW_SOURCE, SourcePicker, emptyChoice, type SourceChoice } from "./SourcePicker";
import { KeepMenu } from "./KeepMenu";

/** Typed Fields are written a moment after the typing stops, as the Vault's editor writes. */
const WRITE_DELAY = 500;

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
  const set = (patch: Record<string, unknown>) => patchDocument(s.id, patch);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceField label="Kind" value={s.kind ?? ""} options={SOURCE_KINDS} optional onCommit={(kind) => set({ kind })} />
        <CommitField label="Author" delay={WRITE_DELAY} value={s.author ?? ""} onCommit={(author) => set({ author })} />
        <CommitField label="URL" type="url" delay={WRITE_DELAY} value={s.url ?? ""} onCommit={(url) => set({ url })} />
        <CommitField label="Published" type="date" value={s.publishedOn ?? ""} onCommit={(publishedOn) => set({ publishedOn })} />
      </div>
      <ChoiceField label="Part of" value={s.parent ?? ""} options={parents} optional onCommit={(parent) => set({ parent })} />
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
  const { all, current } = useCaptureSources();
  const [choice, setChoice] = useState<SourceChoice | null>(null);
  const [error, setError] = useState("");
  const shown = choice ?? { ...emptyChoice, id: note.source ?? "" };
  // A refused move shows under the Source, as any field's refusal does.
  const settle = (p: Promise<unknown>) =>
    p.then(
      () => setError(""),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  const pick = (next: SourceChoice) => {
    if (next.id === NEW_SOURCE) return setChoice(next);
    setChoice(null);
    if (next.id && next.id !== note.source) void settle(patchDocument(note.id, { source: next.id }));
  };
  const makeNew = () =>
    void settle(
      resolveChoice(shown)
        .then((source) => patchDocument(note.id, { source }))
        .then(() => setChoice(null)),
    );
  return (
    <div className="grid gap-3">
      <Field label="Source" error={error}>
        <SourcePicker current={current} all={all} value={shown} onChange={pick} />
      </Field>
      {shown.id === NEW_SOURCE && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!shown.newTitle.trim()} onClick={makeNew}>
            Put it on this new Source
          </Button>
        </div>
      )}
      <CommitField label="Where" delay={WRITE_DELAY} value={note.locator ?? ""} placeholder="Page, chapter, 34:12" onCommit={(locator) => patchDocument(note.id, { locator })} />
      <AliasesField doc={doc} />
      <TagsField doc={doc} />
      <div>
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground px-1"
          onClick={() =>
            void thoughtFromNote(note.id)
              .then(() => toast.success("A Thought again — no Source"))
              .catch((e: Error) => toast.error("Couldn’t take its Source away", { description: e.message }))
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
      <div className="grid gap-3 md:grid-cols-[10rem_1fr]">
        <CommitField label="Where" delay={WRITE_DELAY} value={q.locator ?? ""} placeholder="Page, chapter, 34:12" onCommit={(locator) => patchDocument(q.id, { locator })} />
        <CommitField label="Comment" delay={WRITE_DELAY} value={q.comment ?? ""} placeholder="Your comment" onCommit={(comment) => patchDocument(q.id, { comment })} />
      </div>
      <TagsField doc={doc} />
    </div>
  );
}
