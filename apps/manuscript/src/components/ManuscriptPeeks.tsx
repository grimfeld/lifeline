import { useDocument, type PeekProps } from "@lifeline/core";
import { ChoiceField, TagsField, savePatch } from "@lifeline/editor";
import { Button, toast } from "@lifeline/ui";
import { ArrowDown, ArrowUp } from "lucide-react";
import { moveChapterBy, useChapters } from "../data/repo";
import { FORMS, STATUSES, type Chapter, type Manuscript } from "../domain/types";

/** The Manuscript App's part of a Manuscript's Peek (ADR 0085): its form and status, how many Chapters, its Tags. */
export function ManuscriptPeek({ doc }: PeekProps) {
  const m = doc as Manuscript;
  const chapters = useChapters(m.id);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <ChoiceField label="Form" value={m.form ?? ""} options={FORMS} onChange={(form) => void savePatch(m.id, { form })} />
        <ChoiceField label="Status" value={m.status ?? ""} options={STATUSES} onChange={(status) => void savePatch(m.id, { status })} />
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">{chapters.length === 1 ? "1 Chapter" : `${chapters.length} Chapters`}</p>
      <TagsField doc={doc} />
    </div>
  );
}

/**
 * The Manuscript App's part of a Chapter's Peek (ADR 0085): where it stands in
 * its Manuscript — moved earlier or later as the Manuscript's outline moves it,
 * never by writing its guarded order — its status and its Tags.
 */
export function ChapterPeek({ doc }: PeekProps) {
  const c = doc as Chapter;
  const manuscript = useDocument<Manuscript>(c.manuscriptId);
  const chapters = useChapters(c.manuscriptId);
  const i = chapters.findIndex((x) => x.id === c.id);
  const move = (by: -1 | 1) => void moveChapterBy(c.manuscriptId, c.id, by).catch((e: Error) => toast.error(e.message));
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground min-w-0 flex-1 [overflow-wrap:anywhere]">
          {i >= 0 ? `Chapter ${i + 1} of ${chapters.length}` : "Chapter"}
          {manuscript && ` in ${manuscript.title}`}
        </span>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="outline" disabled={i <= 0} onClick={() => move(-1)}>
            <ArrowUp /> Earlier
          </Button>
          <Button size="sm" variant="outline" disabled={i < 0 || i >= chapters.length - 1} onClick={() => move(1)}>
            <ArrowDown /> Later
          </Button>
        </div>
      </div>
      <ChoiceField label="Status" value={c.status ?? ""} options={STATUSES} onChange={(status) => void savePatch(c.id, { status })} />
      <TagsField doc={doc} />
    </div>
  );
}
