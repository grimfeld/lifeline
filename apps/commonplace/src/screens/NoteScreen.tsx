import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@lifeline/ui";
import { documentType, useDocument, useLinkIndex } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ArrowLeft } from "lucide-react";
import { NOTE, SHELF_HREF, sourceHref, type Note } from "../domain/types";

/** One Note, written beside its Source (ADR 0070) — the Source one step back. */
export function NoteScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const note = useDocument<Note>(id);
  const source = useDocument(note?.source);
  const index = useLinkIndex();
  if (!note) return <div className="text-muted-foreground p-6 text-sm">This note isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  const back = note.source ? sourceHref(note.source) : SHELF_HREF;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-w-0 items-center gap-2 border-b px-3 py-1.5">
        <Button asChild size="sm" variant="ghost" className="h-7 min-w-0">
          <Link to={back}>
            <ArrowLeft className="shrink-0" /> <span className="truncate">{source?.title ?? "Notes"}</span>
          </Link>
        </Button>
      </div>
      <DocumentEditor key={note.id} doc={note} def={documentType(NOTE)} index={index} onDeleted={() => navigate(back)} />
    </div>
  );
}
