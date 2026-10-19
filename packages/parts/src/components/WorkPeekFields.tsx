import type { ReactNode } from "react";
import { CommitField } from "@lifeline/ui";
import { MarksControls } from "./Marks";

/** A work's plain Fields as the family Apps share them (Library, Cinema, Discotheque, Arcade). */
export interface PeekWork {
  id: string;
  year: number;
  size: number;
  reason: string;
  coverUrl: string;
  liked?: boolean;
  rating?: number;
}

/** How soon a typed Field is written in a family Peek: a moment after the typing stops, as the Vault's editor writes. */
export const PEEK_WRITE_DELAY = 500;

/** A number Field as the family keeps it: blank reads and writes as 0, the family's "unknown". */
const shownNumber = (n: number) => (n ? String(n) : "");
const parseNumber = (s: string) => Number(s) || 0;

/**
 * A family work's own plain Fields, edited in its Peek (ADR 0085): who made it
 * (the App's control — the Library's Authors are links, the others' a name),
 * Year, the medium's size, the Marks where the App keeps them, the Reason and
 * the cover. Each is a `CommitField`, written a moment after the typing stops;
 * guarded Fields get no control here — they move through the App's operations.
 */
export function WorkPeekFields({
  work,
  onPatch,
  creator,
  sizeUnit,
  marks,
}: {
  work: PeekWork;
  /** The App's write; a refusal (throw) shows under the field. */
  onPatch: (patch: Partial<PeekWork> & Record<string, unknown>) => unknown;
  /** The App's control for who made it. */
  creator: ReactNode;
  /** "pages", "minutes", "tracks"… */
  sizeUnit: string;
  /** The heart and the stars, for an App that keeps the Marks on its works. */
  marks?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {creator}
      <div className="grid grid-cols-2 gap-2">
        <CommitField label="Year" type="number" delay={PEEK_WRITE_DELAY} value={shownNumber(work.year)} onCommit={(s) => onPatch({ year: parseNumber(s) })} />
        <CommitField
          label={<span className="capitalize">{sizeUnit}</span>}
          type="number"
          delay={PEEK_WRITE_DELAY}
          value={shownNumber(work.size)}
          onCommit={(s) => onPatch({ size: parseNumber(s) })}
        />
      </div>
      {marks && <MarksControls liked={!!work.liked} rating={work.rating ?? 0} onChange={(p) => void onPatch(p)} />}
      <CommitField
        label="Reason"
        multiline
        rows={3}
        delay={PEEK_WRITE_DELAY}
        value={work.reason}
        placeholder="Who recommended it, or what made you want it."
        onCommit={(reason) => onPatch({ reason })}
      />
      <CommitField label="Cover URL" type="url" delay={PEEK_WRITE_DELAY} value={work.coverUrl} placeholder="https://…" onCommit={(coverUrl) => onPatch({ coverUrl })} />
    </div>
  );
}
