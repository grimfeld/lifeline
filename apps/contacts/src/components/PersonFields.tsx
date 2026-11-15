import { normalizeTag, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { Checkbox, CommitField, Field, TagInput } from "@lifeline/ui";
import type { Person } from "../domain/types";
import { asName } from "../domain/person";
import { normalizePerson, patchPerson } from "../data/repo";

/** How long after the typing stops a field is written, as a Peek writes (ADR 0085). */
const WRITE_DELAY = 500;

/**
 * What the Contacts App edits on every Person, on their page and in their
 * Peek alike: the other names they go by, what they are to me, and their Tags.
 * The name, the body and the user's own Fields are the page's or Core's.
 * The Person page edits the Relationship and the Given and Family names under the name, so it leaves them out here.
 */
export function PersonFields({ person, relationship = true, nameFields = true }: { person: Person; relationship?: boolean; nameFields?: boolean }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  return (
    <div className="grid min-w-0 gap-3">
      {nameFields && (
        <>
          <CommitField label="Given name" hint="Their own name: it links to them like an alias, and never changes the title." delay={WRITE_DELAY} value={person.givenName ?? ""} placeholder="Anne" onCommit={(givenName) => patchPerson(person.id, { givenName })} />
          <CommitField label="Family name" hint="The name they share with their family." delay={WRITE_DELAY} value={person.familyName ?? ""} placeholder="Dupont" onCommit={(familyName) => patchPerson(person.id, { familyName })} />
        </>
      )}
      <Field label="Aliases" hint="Other names they go by: each one links to them.">
        <TagInput value={person.aliases} onChange={(aliases) => void patchPerson(person.id, { aliases })} normalize={asName} placeholder="Mum, Anne…" />
      </Field>
      {relationship && (
        <CommitField
          label="Relationship"
          hint="What they are to you, in your own words."
          delay={WRITE_DELAY}
          value={person.relationship}
          placeholder="my aunt"
          onCommit={(relationship) => patchPerson(person.id, { relationship })}
        />
      )}
      {/* The box before its words, as a checkbox reads. */}
      <Field label="Excluded from Drifting" className="flex min-w-0 flex-row-reverse items-center justify-end gap-2">
        <Checkbox checked={person.excludedFromDrifting === true} onCheckedChange={(v) => void patchPerson(person.id, { excludedFromDrifting: v === true })} />
      </Field>
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
