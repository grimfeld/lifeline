import { Button, CommitField, Field, TagInput } from "@lifeline/ui";
import { normalizeTag, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { PEEK_WRITE_DELAY, WorkPeekFields } from "@lifeline/parts";
import { ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { normalize, patchWork } from "../data/repo";
import { ACQ_LABEL } from "../domain/types";
import { WorkActionsMenu } from "./WorkActions";

/**
 * A game's editable Peek (ADR 0085): where it stands, the Arcade's own
 * transitions for the guarded Shelf and Owned, and its plain Fields edited in
 * place. The title and the user's own Fields are Core's.
 */
export function WorkPeek({ doc }: PeekProps) {
  const item = normalize(doc as Work);
  const def = workType(item.type);
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground min-w-0 flex-1 text-sm">
          {[def.engagement[item.engagement], ACQ_LABEL[item.acquisition]].filter(Boolean).join(" · ")}
        </span>
        <WorkActionsMenu
          item={item}
          trigger={
            <Button size="sm" variant="outline" className="shrink-0">
              Shelf <ChevronDown />
            </Button>
          }
        />
      </div>
      <ArcadeWorkFields item={item} />
    </div>
  );
}

/** A game's plain Fields, edited in place — in its Peek and on its page alike: the family's (Developer, Year, hours, Reason, cover) and, on the page, its Tags. No Marks: games keep none. */
export function ArcadeWorkFields({ item, tags }: { item: Work; tags?: boolean }) {
  const def = workType(item.type);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  return (
    <WorkPeekFields
      work={item}
      onPatch={(patch) => patchWork(item, patch)}
      sizeUnit={def.sizeUnit}
      creator={<CommitField label={def.creatorLabel} delay={PEEK_WRITE_DELAY} value={item.creator} onCommit={(creator) => patchWork(item, { creator })} />}
      extra={
        tags ? (
          <Field label="Tags">
            <TagInput value={item.tags ?? []} onChange={(t) => void patchWork(item, { tags: t })} suggestions={tagSuggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </Field>
        ) : undefined
      }
    />
  );
}
