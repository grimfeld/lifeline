import { useSearchParams } from "react-router";
import { todayStr, type DateStr } from "@lifeline/core";
import { useNoteIndex, useNotes } from "../data/repo";
import { NoteView } from "../workspace/NoteView";

/** /notes/journal?d=YYYY-MM-DD — the daily note open in the workspace. */
export function JournalScreen() {
  const [params] = useSearchParams();
  const today = todayStr();
  const date: DateStr = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : today;
  const notes = useNotes();
  const index = useNoteIndex();
  const note = notes.find((n) => n.type === "daily" && n.title === date);
  return <NoteView note={note} index={index} date={date} />;
}
