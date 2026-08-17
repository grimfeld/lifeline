import type { DateStr, SyncedRecord } from "@lifeline/core";
import type { NoteTypeId } from "./noteTypes";

/**
 * A Note (CONTEXT.md, ADR 0009): a title plus raw markdown. The text is the
 * truth — properties (frontmatter), links, tags and headings are derived
 * from `body` and never stored beside it.
 */
export interface Note extends SyncedRecord {
  type: NoteTypeId;
  title: string;
  /** Full markdown including the frontmatter block, if any. */
  body: string;
  createdAt: DateStr;
}

export const NOTES = "notes";
