import { useId } from "react";
import { Button, Checkbox, Field, Label, CommitField, TagInput } from "@lifeline/ui";
import { normalizeTag, useOpenPeek, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { PEEK_WRITE_DELAY, WorkPeekFields } from "@lifeline/parts";
import { ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Playlist, Work } from "../domain/types";
import { worksOf } from "../domain/playlist";
import { normalize, normalizePlaylist, patchPlaylist, patchWork, useWorks } from "../data/repo";
import { WorkActionsMenu } from "./WorkActions";
import { PlaylistWorks } from "./PlaylistsTab";

/**
 * An album's editable Peek (ADR 0085): where it stands on the Shelf,
 * the Discotheque's own transitions for it (the Shelf is guarded), and its plain
 * Fields edited in place. The body (its Review), title and the user's own
 * Fields are Core's.
 */
export function WorkPeek({ doc }: PeekProps) {
  const item = normalize(doc as Work);
  const def = workType(item.type);
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground min-w-0 flex-1 text-sm">{def.engagement[item.engagement]}</span>
        <WorkActionsMenu
          item={item}
          trigger={
            <Button size="sm" variant="outline" className="shrink-0">
              Shelf <ChevronDown />
            </Button>
          }
        />
      </div>
      <DiscothequeWorkFields item={item} />
    </div>
  );
}

/**
 * An album's plain Fields, edited in place — in its Peek and on its page alike:
 * the family's (Artist, Year, tracks, Marks, Reason, cover) and, on the page,
 * its Tags.
 */
export function DiscothequeWorkFields({ item, tags }: { item: Work; tags?: boolean }) {
  const def = workType(item.type);
  const tagSuggestions = useTagVocabulary().map((v) => v.tag);
  return (
    <WorkPeekFields
      work={item}
      onPatch={(patch) => patchWork(item, patch)}
      sizeUnit={def.sizeUnit}
      marks
      extra={
        tags && (
          <Field label="Tags">
            <TagInput value={item.tags ?? []} onChange={(t) => void patchWork(item, { tags: t })} suggestions={tagSuggestions} normalize={normalizeTag} placeholder="Add tag…" />
          </Field>
        )
      }
      creator={<CommitField label={def.creatorLabel} delay={PEEK_WRITE_DELAY} value={item.creator} onCommit={(creator) => patchWork(item, { creator })} />}
    />
  );
}

/** A Playlist's editable Peek: Ranked, and its works moved and removed through the Discotheque's own list (the order is guarded). */
export function PlaylistPeek({ doc }: PeekProps) {
  const playlist = normalizePlaylist(doc as Playlist);
  const items = useWorks();
  // Inside the Peek a work opens in its place, with the way back (ADR 0085).
  const peek = useOpenPeek();
  const works = worksOf(playlist, new Map(items.map((w) => [w.id, w])));
  const rankedId = useId();
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id={rankedId} checked={playlist.ranked} onCheckedChange={(v) => void patchPlaylist(playlist, { ranked: v === true })} />
        <Label htmlFor={rankedId} className="text-sm font-normal">
          Ranked
        </Label>
      </div>
      <PlaylistWorks playlist={playlist} works={works} onOpenWork={(w) => peek(w.id)} />
    </div>
  );
}
