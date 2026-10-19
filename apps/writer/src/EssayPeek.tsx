import type { PeekProps } from "@lifeline/core";
import { TagsField } from "@lifeline/editor";
import { ChoiceField } from "@lifeline/ui";
import { setStatus } from "./data";
import { STATUSES, wordCount, type Essay } from "./types";

/**
 * The Research App's part of an Essay's Peek (ADR 0085): its status, set as
 * the Research desk sets it, its length and pinned material at a glance, and
 * its Tags — Essays on a topic are grouped by Tag (ADR 0068).
 */
export function EssayPeek({ doc }: PeekProps) {
  const essay = doc as Essay;
  const pinned = Array.isArray(essay.material) ? essay.material.length : 0;
  return (
    <div className="grid gap-3">
      <ChoiceField
        label="Status"
        value={essay.status ?? ""}
        options={STATUSES}
        onCommit={(status) => setStatus(doc.id, status as Essay["status"])}
      />
      <p className="text-muted-foreground text-xs tabular-nums">
        {wordCount(typeof essay.body === "string" ? essay.body : "")} words
        {pinned > 0 && ` · ${pinned} pinned as material`}
      </p>
      <TagsField doc={doc} />
    </div>
  );
}
