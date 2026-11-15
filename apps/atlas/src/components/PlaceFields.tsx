import { normalizeTag, useDocumentTypes, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { ChoiceField, Field, TagInput } from "@lifeline/ui";
import type { Place } from "../domain/types";
import { normalizePlace } from "../domain/place";
import { kindOptions, patchPlace } from "../data/repo";

/** An alias is a name, kept as written: not lower-cased and hyphenated as a Tag is. */
const asName = (raw: string) => raw.trim() || null;

/**
 * What the Atlas App edits on every Place, on its page and in its Peek alike:
 * its Kind, the other names it goes by, and its Tags. The name, the body and
 * the user's own Fields are the page's or Core's.
 */
export function PlaceFields({ place }: { place: Place }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  // Read with the types, so a Kind renamed elsewhere shows at once.
  useDocumentTypes();
  return (
    <div className="grid min-w-0 gap-3">
      <ChoiceField label="Kind" value={place.kind} options={kindOptions()} optional onCommit={(kind) => patchPlace(place.id, { kind })} />
      <Field label="Aliases" hint="Other names for it: each one links to it.">
        <TagInput value={place.aliases} onChange={(aliases) => void patchPlace(place.id, { aliases })} normalize={asName} placeholder="Janou, the Orsay…" />
      </Field>
      <Field label="Tags">
        <TagInput value={place.tags ?? []} onChange={(tags) => void patchPlace(place.id, { tags })} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      </Field>
    </div>
  );
}

/** A Place's editable Peek (ADR 0085): the Atlas App's Fields; Core frames it with the name, the body and the way through to its page. */
export function PlacePeek({ doc }: PeekProps) {
  return <PlaceFields place={normalizePlace(doc)} />;
}
