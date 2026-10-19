import { Button, Checkbox, Label } from "@lifeline/ui";
import { openPeek, type PeekProps } from "@lifeline/core";
import { PeekInput, WorkPeekFields } from "@lifeline/parts";
import { ChevronDown } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Playlist, Work } from "../domain/types";
import { worksOf } from "../domain/playlist";
import { normalize, normalizePlaylist, patchPlaylist, patchWork, useWorks } from "../data/repo";
import { WorkActionsMenu } from "./WorkActions";
import { PlaylistWorks } from "./PlaylistsTab";

/**
 * A film's or series' editable Peek (ADR 0085): where it stands on the Shelf,
 * the Cinema's own transitions for it (the Shelf is guarded), and its plain
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
      <WorkPeekFields
        work={item}
        onPatch={(patch) => void patchWork(item, patch)}
        sizeUnit={def.sizeUnit}
        marks
        creator={<PeekInput id="peek-work-creator" label={def.creatorLabel} value={item.creator} onCommit={(creator) => void patchWork(item, { creator })} />}
      />
    </div>
  );
}

/** A Playlist's editable Peek: Ranked, and its works moved and removed through the Cinema's own list (the order is guarded). */
export function PlaylistPeek({ doc }: PeekProps) {
  const playlist = normalizePlaylist(doc as Playlist);
  const items = useWorks();
  const works = worksOf(playlist, new Map(items.map((w) => [w.id, w])));
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <Checkbox id="peek-playlist-ranked" checked={playlist.ranked} onCheckedChange={(v) => void patchPlaylist(playlist, { ranked: v === true })} />
        <Label htmlFor="peek-playlist-ranked" className="text-sm font-normal">
          Ranked
        </Label>
      </div>
      <PlaylistWorks playlist={playlist} works={works} onOpenWork={(w) => openPeek(w.id)} />
    </div>
  );
}
