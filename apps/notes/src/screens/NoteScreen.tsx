import { useParams } from "react-router";
import { useNote, useNoteIndex } from "../data/repo";
import { NoteEditor } from "../components/NoteEditor";

/** Hidden route notes/:id — one note in the editor. */
export function NoteScreen() {
  const { id } = useParams<{ id: string }>();
  const note = useNote(id);
  const index = useNoteIndex();
  if (!note) return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Note not found.</div>;
  return <NoteEditor key={note.id} note={note} index={index} autoFocus />;
}
