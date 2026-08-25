import type { CommandDef } from "@lifeline/core";
import { BookOpen, NotebookPen, Plus } from "lucide-react";
import { NoteOnVerseDialog, ReferenceDialog } from "./components/Dialogs";
import { CHARACTER, CONCEPT, DESK_HREF } from "./domain/types";

function NewCharacterDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ReferenceDialog {...props} type={CHARACTER} />;
}
function NewConceptDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <ReferenceDialog {...props} type={CONCEPT} />;
}

export const bibleCommands: CommandDef[] = [
  { id: "bible.note-on-verse", title: "Note on a verse", keywords: ["bible", "verse", "scripture", "study", "note"], icon: NotebookPen, dialog: NoteOnVerseDialog, capture: true },
  { id: "bible.new-character", title: "New character", keywords: ["bible", "character", "person"], icon: Plus, dialog: NewCharacterDialog },
  { id: "bible.new-concept", title: "New concept", keywords: ["bible", "concept", "theme", "idea"], icon: Plus, dialog: NewConceptDialog },
  { id: "bible.desk", title: "Go to Bible study", keywords: ["bible", "scripture", "study", "verses"], icon: BookOpen, run: ({ navigate }) => navigate(DESK_HREF) },
];
