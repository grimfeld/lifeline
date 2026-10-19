import { patchDocument, type PeekProps } from "@lifeline/core";
import { AliasesField, TagsField } from "@lifeline/editor";
import { ChoiceField } from "@lifeline/ui";
import { THOUGHT_KINDS, type Thought } from "../domain/types";

/** The Thoughts App's part of a Thought's Peek (ADR 0085): what kind of thought it is, the names it goes by, its Tags. */
export function ThoughtPeek({ doc }: PeekProps) {
  const thought = doc as Thought;
  return (
    <div className="grid gap-3">
      <ChoiceField label="Kind" value={thought.kind ?? ""} options={THOUGHT_KINDS} optional onCommit={(kind) => patchDocument(doc.id, { kind })} />
      <AliasesField doc={doc} />
      <TagsField doc={doc} />
    </div>
  );
}
