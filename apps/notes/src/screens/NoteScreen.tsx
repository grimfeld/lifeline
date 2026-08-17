import { Navigate, useParams } from "react-router";
import { useNote, useNoteIndex } from "../data/repo";
import { NoteView } from "../workspace/NoteView";
import { journalHref } from "../workspace/useOpenNote";

/** /notes/n/:id — one note; daily notes redirect to their journal URL so the date toolbar shows. */
export function NoteScreen() {
  const { id } = useParams<{ id: string }>();
  const note = useNote(id);
  const index = useNoteIndex();
  if (note?.type === "daily") return <Navigate to={journalHref(note.title)} replace />;
  return <NoteView note={note} index={index} />;
}
