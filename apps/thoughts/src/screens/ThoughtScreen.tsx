import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@lifeline/ui";
import { documentType, useDocument, useLinkIndex } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ArrowLeft } from "lucide-react";
import { THOUGHT, THOUGHTS_HREF, type Thought } from "../domain/types";

/** One Thought, written where Thoughts live (ADR 0068) — the stream one step back. */
export function ThoughtScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const thought = useDocument<Thought>(id);
  const index = useLinkIndex();
  if (!thought) {
    return <div className="text-muted-foreground p-6 text-sm">This thought isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Button asChild size="sm" variant="ghost" className="h-7">
          <Link to={THOUGHTS_HREF}>
            <ArrowLeft /> Thoughts
          </Link>
        </Button>
      </div>
      <DocumentEditor key={thought.id} doc={thought} def={documentType(THOUGHT)} index={index} onDeleted={() => navigate(THOUGHTS_HREF)} />
    </div>
  );
}
