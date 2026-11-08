import { normalizeTag, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { CommitField, Field, TagInput } from "@lifeline/ui";
import type { Person } from "../domain/types";
import { normalizePerson, patchPerson } from "../data/repo";

/** How long after the typing stops a field is written, as a Peek writes (ADR 0085). */
const WRITE_DELAY = 500;

/** An alias is a name, kept as written: not lower-cased and hyphenated as a Tag is. */
const asName = (raw: string) => raw.trim() || null;

/**
 * What the Contacts App edits on every Person, on their page and in their
 * Peek alike: the other names they go by, what they are to me, and their Tags.
 * The name, the body and the user's own Fields are the page's or Core's.
 */
export function PersonFields({ person }: { person: Person }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  return (
    <div className="grid min-w-0 gap-3">
      <Field label="Aliases" hint="Other names they go by: each one links to them.">
        <TagInput value={person.aliases} onChange={(aliases) => void patchPerson(person.id, { aliases })} normalize={asName} placeholder="Mum, Anne…" />
      </Field>
      <CommitField
        label="Relationship"
        hint="What they are to you, in your own words."
        delay={WRITE_DELAY}
        value={person.relationship}
        placeholder="my aunt"
        onCommit={(relationship) => patchPerson(person.id, { relationship })}
      />
      <Field label="Tags">
        <TagInput value={person.tags ?? []} onChange={(tags) => void patchPerson(person.id, { tags })} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      </Field>
    </div>
  );
}

/** A Person's editable Peek (ADR 0085): the Contacts App's Fields; Core frames it with the name, the body and the way through to their page. */
export function PersonPeek({ doc }: PeekProps) {
  return <PersonFields person={normalizePerson(doc as Person)} />;
}
