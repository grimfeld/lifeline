import type { MouseEvent } from "react";
import { useNavigate } from "react-router";
import { docHref, excerpt, formatHuman, useLinkIndex, type CardProps } from "@lifeline/core";
import { CardUnavailable } from "@lifeline/ui";
import { MarkdownView } from "@lifeline/editor";
import { useNotes } from "../data/repo";
import { DAILY } from "../domain/types";

/** Card: one chosen note, rendered (knobs: note, read/excerpt mode). Click anywhere (but links) opens it. */
export function PinnedNoteCard({ settings, configure }: CardProps) {
  const id = String(settings.note ?? "");
  const mode = String(settings.mode ?? "read");
  const notes = useNotes();
  const index = useLinkIndex();
  const navigate = useNavigate();
  const note = notes.find((n) => n.id === id);
  if (!note) return <CardUnavailable message="This note no longer exists." onConfigure={configure} />;
  const open = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest("a,button")) return;
    navigate(docHref(note));
  };
  const text = mode === "excerpt" ? excerpt(note.body, 800) : "";
  return (
    <div className="hover:bg-accent/40 h-full cursor-pointer overflow-y-auto rounded-md text-sm" onClick={open}>
      {mode === "excerpt" ? (
        text ? <div className="whitespace-pre-line">{text}</div> : <span className="text-muted-foreground italic">Empty note.</span>
      ) : (
        <MarkdownView body={note.body} index={index} docDate={note.type === DAILY ? note.title : null} compact />
      )}
    </div>
  );
}

/** Instance title = the note's title (dates humanised); hook, so renames follow. */
export function usePinnedNoteTitle(settings: CardProps["settings"]): string {
  const id = String(settings.note ?? "");
  const n = useNotes().find((x) => x.id === id);
  return n ? (n.type === DAILY ? formatHuman(n.title) : n.title) : "Pinned note";
}
