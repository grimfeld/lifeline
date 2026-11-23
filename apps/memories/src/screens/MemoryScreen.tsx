import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@lifeline/ui";
import { documentType, useDocument, useLinkIndex } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ArrowLeft } from "lucide-react";
import { MEMORY, type Memory } from "../domain/types";

/** Where a Memory leads back to: the Memories grid. */
const BACK = "/app/journal/memories";

/**
 * One Memory, written in the Journal's writing interface (ADR 0136): its
 * title, date, About and body (words and photos), all editable here.
 */
export function MemoryScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const memory = useDocument<Memory>(id);
  const index = useLinkIndex();
  if (!memory || memory.type !== MEMORY) {
    return <div className="text-muted-foreground p-6 text-sm">This memory isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Button asChild size="sm" variant="ghost">
          <Link to={BACK}>
            <ArrowLeft /> Memories
          </Link>
        </Button>
      </div>
      <DocumentEditor key={memory.id} doc={memory} def={documentType(MEMORY)} index={index} onDeleted={() => navigate(BACK)} />
    </div>
  );
}
