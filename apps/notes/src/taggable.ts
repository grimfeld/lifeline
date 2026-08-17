import { formatHuman, type TaggableProvider, type TaggedItem } from "@lifeline/core";
import { useNoteIndex } from "./data/repo";
import { noteType } from "./data/noteTypes";
import { extractTags } from "./domain/markdown";
import type { Note } from "./domain/types";

const APP_ID = "notes";

/** Route that opens a note: date-titled notes open in the Journal, the rest on their own screen. */
export function noteHref(n: Note): string {
  return noteType(n.type).titleRule === "date" ? `/notes/journal?d=${n.title}` : `/notes/n/${n.id}`;
}

/**
 * The Taggable Contract for Notes (ADR 0014): every live note whose text
 * carries a tag — prose `#tags` ∪ the frontmatter `tags` list (ADR 0009: the
 * text is the truth, nothing is stored in a `tags` field).
 */
export const notesTaggable: TaggableProvider = {
  appId: APP_ID,
  useTagged() {
    const index = useNoteIndex();
    const out: TaggedItem[] = [];
    for (const n of index.notes) {
      const tags = extractTags(n.body);
      if (tags.length === 0) continue;
      const def = noteType(n.type);
      out.push({
        appId: APP_ID,
        itemId: n.id,
        title: def.titleRule === "date" ? formatHuman(n.title) : n.title,
        subtitle: n.folder || def.label,
        tags,
        href: noteHref(n),
      });
    }
    return out;
  },
};
