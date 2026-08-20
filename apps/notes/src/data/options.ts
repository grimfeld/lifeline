import { useMemo } from "react";
import { allFolders, buildTree, displayTitle, docPath, formatHuman, useAllDocuments, useDocumentTypes, useExtraFolders, useLinkIndex, type CardOption } from "@lifeline/core";
import { useNotes } from "./repo";
import { DAILY, TEMPLATE } from "../domain/types";

/** Option hooks for card knobs (entity fields). */

/** Notes (not templates) by title — for "Mentions of…" / "Pinned note". */
export function useNoteOptions(): CardOption[] {
  const notes = useNotes();
  return useMemo(
    () =>
      notes
        .filter((n) => n.type !== TEMPLATE)
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
        .map((n) => ({ value: n.id, label: n.type === DAILY ? formatHuman(n.title) : docPath(n) })),
    [notes],
  );
}

/** Every non-internal Document (any type), for link-target knobs. */
export function useAnyDocumentOptions(): CardOption[] {
  const docs = useAllDocuments();
  const types = useDocumentTypes();
  return useMemo(() => {
    const defs = new Map(types.map((t) => [t.id, t]));
    return docs
      .filter((d) => !defs.get(d.type)?.internal && defs.get(d.type)?.linkable)
      .map((d) => ({ value: d.id, label: `${d.type === DAILY ? formatHuman(d.title) : displayTitle(d, defs.get(d.type))} · ${defs.get(d.type)?.label ?? d.type}` }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [docs, types]);
}

export function useFolderOptions(): CardOption[] {
  const notes = useNotes();
  const extra = useExtraFolders();
  return useMemo(() => allFolders(buildTree(notes, extra)).map((f) => ({ value: f, label: f })), [notes, extra]);
}

export function useTagOptions(): CardOption[] {
  const index = useLinkIndex();
  return useMemo(
    () =>
      Array.from(index.tags.entries())
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
        .map(([tag, ids]) => ({ value: tag, label: `#${tag} · ${ids.length}` })),
    [index],
  );
}

/** Non-internal Document types, for "type" knobs. */
export function useTypeOptions(opts: { excludeDaily?: boolean; excludeTemplate?: boolean } = {}): CardOption[] {
  const types = useDocumentTypes();
  return useMemo(
    () =>
      types
        .filter((t) => !t.internal && !(opts.excludeDaily && t.id === DAILY) && !(opts.excludeTemplate && t.id === TEMPLATE))
        .map((t) => ({ value: t.id, label: t.label })),
    [types, opts.excludeDaily, opts.excludeTemplate],
  );
}
