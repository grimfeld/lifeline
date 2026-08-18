import { useMemo } from "react";
import type { CardOption } from "@lifeline/core";
import { formatHuman } from "@lifeline/core";
import { useNoteIndex, useNotes, useExtraFolders } from "./repo";
import { allFolders, buildTree, notePath } from "../domain/folders";

/** Option hooks for card knobs (entity fields). */

export function useNoteOptions(): CardOption[] {
  const notes = useNotes();
  return useMemo(
    () =>
      notes
        .filter((n) => n.type !== "template")
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
        .map((n) => ({ value: n.id, label: n.type === "daily" ? formatHuman(n.title) : notePath(n) })),
    [notes],
  );
}

export function useFolderOptions(): CardOption[] {
  const notes = useNotes();
  const extra = useExtraFolders();
  return useMemo(() => allFolders(buildTree(notes, extra)).map((f) => ({ value: f, label: f })), [notes, extra]);
}

export function useTagOptions(): CardOption[] {
  const index = useNoteIndex();
  return useMemo(
    () =>
      Array.from(index.tags.entries())
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([tag, ids]) => ({ value: tag, label: `#${tag} · ${ids.length}` })),
    [index],
  );
}
