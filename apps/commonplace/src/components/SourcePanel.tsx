import { useState } from "react";
import { useNavigate } from "react-router";
import { Button, toast } from "@lifeline/ui";
import type { Document, LinkIndex } from "@lifeline/core";
import { Link2, Link2Off } from "lucide-react";
import { noteFromThought, thoughtFromNote } from "../data/notes";
import { NOTE, noteHref } from "../domain/types";
import { SourcePicker, emptyChoice, type SourceChoice } from "./SourcePicker";
import { resolveChoice, useCaptureSources } from "./CaptureForm";

/**
 * On a Thought or a Note (ADR 0070): the one act between them. A Thought given
 * a Source becomes a Note on it; a Note whose Source is taken away is a
 * Thought again — the same Document, so every link to it holds.
 */
export function SourcePanel({ doc }: { doc: Document; index: LinkIndex }) {
  const navigate = useNavigate();
  const { all, current } = useCaptureSources();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<SourceChoice>(emptyChoice);

  if (doc.type === NOTE) {
    return (
      <section className="text-sm">
        <Button
          size="sm"
          variant="ghost"
          className="text-muted-foreground h-7 px-1"
          onClick={() =>
            void thoughtFromNote(doc.id)
              .then((t) => {
                toast.success("A Thought again — no Source");
                navigate(`/app/thoughts/${t.id}`);
              })
              .catch((e: Error) => toast.error(e.message))
          }
        >
          <Link2Off /> Take its Source away
        </Button>
      </section>
    );
  }
  if (doc.type !== "thought") return null;
  return (
    <section className="grid gap-2 text-sm">
      {!open ? (
        <Button size="sm" variant="ghost" className="text-muted-foreground h-7 justify-start px-1" onClick={() => setOpen(true)}>
          <Link2 /> It came from a Source…
        </Button>
      ) : (
        <>
          <div className="text-muted-foreground text-xs">Given a Source, this Thought becomes a Note on it.</div>
          <SourcePicker current={current} all={all} value={choice.id || choice.newTitle ? choice : { ...emptyChoice, id: current[0]?.id ?? "" }} onChange={setChoice} id="thought-source" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                void resolveChoice(choice.id || choice.newTitle ? choice : { ...emptyChoice, id: current[0]?.id ?? "" })
                  .then((source) => noteFromThought(doc.id, source))
                  .then((n) => {
                    toast.success("Now a Note on its Source");
                    navigate(noteHref(n.id));
                  })
                  .catch((e: Error) => toast.error(e.message))
              }
            >
              Make it a Note
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
