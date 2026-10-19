import { Button, CommitField, Field, TagInput } from "@lifeline/ui";
import type { PeekProps } from "@lifeline/core";
import { PEEK_WRITE_DELAY, WorkPeekFields } from "@lifeline/parts";
import { ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Author, Work } from "../domain/types";
import { normalize, normalizeAuthor, patchAuthor, patchWork, useWorks } from "../data/repo";
import { ACQ_LABEL } from "./AddWorkDialog";
import { AuthorPicker } from "./AuthorPicker";
import { WorkActionsMenu } from "./WorkActions";

/**
 * A book's, comic's or manga's editable Peek (ADR 0085): where it stands, the
 * Library's own transitions for the guarded Shelf, Owned and slot, and its
 * plain Fields edited in place. The body, title and the user's own Fields are
 * Core's.
 */
export function WorkPeek({ doc }: PeekProps) {
  const item = normalize(doc as Work);
  const all = useWorks();
  const def = workType(item.type);
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground min-w-0 flex-1 text-sm">
          {[def.engagement[item.engagement], ACQ_LABEL[item.acquisition], item.slot > 0 ? `Nightstand #${item.slot}` : ""].filter(Boolean).join(" · ")}
        </span>
        <WorkActionsMenu
          item={item}
          all={all}
          trigger={
            <Button size="sm" variant="outline" className="shrink-0">
              Shelf <ChevronDown />
            </Button>
          }
        />
      </div>
      <WorkPeekFields
        work={item}
        onPatch={(patch) => patchWork(item, patch)}
        sizeUnit={def.sizeUnit}
        marks
        creator={
          <Field label={def.creatorLabel}>
            <AuthorPicker value={item.authors} onChange={(authors) => void patchWork(item, { authors })} online={false} placeholder="Add an author…" />
          </Field>
        }
      />
    </div>
  );
}

/** An Author's editable Peek: the other names it goes by, its years and portrait. */
export function AuthorPeek({ doc }: PeekProps) {
  const author = normalizeAuthor(doc as Author);
  return (
    <div className="grid gap-3">
      <Field label="Aliases">
        <TagInput value={author.aliases} onChange={(aliases) => void patchAuthor(author.id, { aliases })} placeholder="Other names…" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <CommitField label="Born" delay={PEEK_WRITE_DELAY} value={author.born} onCommit={(born) => patchAuthor(author.id, { born })} />
        <CommitField label="Died" delay={PEEK_WRITE_DELAY} value={author.died} onCommit={(died) => patchAuthor(author.id, { died })} />
      </div>
      <CommitField label="Photo URL" type="url" delay={PEEK_WRITE_DELAY} value={author.photoUrl} placeholder="https://…" onCommit={(photoUrl) => patchAuthor(author.id, { photoUrl })} />
    </div>
  );
}
