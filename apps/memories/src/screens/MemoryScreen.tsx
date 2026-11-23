import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, toast } from "@lifeline/ui";
import { documentType, patchDocument, removeDocument, useDocument, useLinkIndex, type Document } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ArrowLeft, Trash2 } from "lucide-react";
import { MemoryForm } from "../components/MemoryForm";
import { patchMemory } from "../data/repo";
import { MEMORY, type Memory } from "../domain/types";

/** Where a Memory leads back to: the Memories grid. */
const BACK = "/app/journal/memories";

/** The Memory's Fields, saved as they change; its title when the box is left. */
function Fields({ memory }: { memory: Memory }) {
  const [title, setTitle] = useState(memory.title);
  const [error, setError] = useState("");
  useEffect(() => setTitle(memory.title), [memory.title]);
  async function save(patch: Parameters<typeof patchMemory>[1]) {
    try {
      await patchMemory(memory.id, patch);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <MemoryForm
      value={{ title, date: memory.date, about: memory.about ?? [] }}
      titleError={error}
      onChange={(patch) => {
        if (patch.title !== undefined) setTitle(patch.title);
        else void save(patch);
      }}
      onTitleBlur={() => (title.trim() === memory.title ? setError("") : void save({ title }))}
    />
  );
}

/**
 * One Memory, on its own page under the Journal (ADR 0136): its title, date
 * and About in the Memory form the add dialog shares, and its body (words and
 * photos) in the writing interface beneath.
 */
export function MemoryScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const memory = useDocument<Memory>(id);
  const index = useLinkIndex();
  // Only the body and its Tags are written from the editor, so a Field changed beside it is never sent back as it was.
  const saveBody = useCallback((next: Document) => patchDocument(next.id, { body: next.body, tags: next.tags }), []);
  if (!memory || memory.type !== MEMORY) {
    return <div className="text-muted-foreground p-6 text-sm">This memory isn't here — it may have been deleted, or it lives in another Workspace.</div>;
  }
  async function remove() {
    try {
      await removeDocument(memory!.id);
    } catch (e) {
      toast.error(`Couldn’t delete “${memory!.title}” — ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    toast.success(`“${memory!.title}” deleted`);
    navigate(BACK);
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Button asChild size="sm" variant="ghost">
          <Link to={BACK}>
            <ArrowLeft /> Memories
          </Link>
        </Button>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void remove()}>
          <Trash2 /> Delete
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-3xl min-w-0 gap-4 p-3">
          <Fields key={memory.id} memory={memory} />
          <div className="min-h-40 min-w-0 rounded-lg border p-2">
            <DocumentEditor key={memory.id} doc={memory} def={documentType(MEMORY)} index={index} bodyOnly bodyLabel="Words" save={saveBody} />
          </div>
        </div>
      </div>
    </div>
  );
}
