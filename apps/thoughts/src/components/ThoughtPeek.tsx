import type { PeekProps } from "@lifeline/core";
import { AliasesField, ChoiceField, TagsField, savePatch } from "@lifeline/editor";
import { THOUGHT_KINDS, type Thought } from "../domain/types";

/** The Thoughts App's part of a Thought's Peek (ADR 0085): what kind of thought it is, the names it goes by, its Tags. */
export function ThoughtPeek({ doc }: PeekProps) {
  const thought = doc as Thought;
  return (
    <div className="grid gap-3">
      <ChoiceField label="Kind" value={thought.kind ?? ""} options={THOUGHT_KINDS} optional onChange={(kind) => void savePatch(doc.id, { kind })} />
      <AliasesField doc={doc} />
      <TagsField doc={doc} />
    </div>
  );
}
