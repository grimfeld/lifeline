import { useEffect, useState } from "react";
import { normalizeTag, useDocumentTypes, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { Button, ChoiceField, Field, TagInput, toast } from "@lifeline/ui";
import type { Place } from "../domain/types";
import { normalizePlace, placeCoordsOf } from "../domain/place";
import { kindOptions, patchPlace, setPlaceAddress, type AddressInput } from "../data/repo";
import { LocateButton, PlaceSearchField, WhereNote } from "./PlaceLookup";

/** An alias is a name, kept as written: not lower-cased and hyphenated as a Tag is. */
const asName = (raw: string) => raw.trim() || null;

/**
 * What the Atlas App edits on every Place, on its page and in its Peek alike:
 * its Kind, its address, the other names it goes by, and its Tags. The name, the body and
 * the user's own Fields are the page's or Core's.
 */
export function PlaceFields({ place }: { place: Place }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  // Read with the types, so a Kind renamed elsewhere shows at once.
  useDocumentTypes();
  return (
    <div className="grid min-w-0 gap-3">
      <ChoiceField label="Kind" value={place.kind} options={kindOptions()} optional onCommit={(kind) => patchPlace(place.id, { kind })} />
      <PlaceAddress key={place.id} place={place} />
      <Field label="Aliases" hint="Other names for it: each one links to it.">
        <TagInput value={place.aliases} onChange={(aliases) => void patchPlace(place.id, { aliases })} normalize={asName} placeholder="Janou, the Orsay…" />
      </Field>
      <Field label="Tags">
        <TagInput value={place.tags ?? []} onChange={(tags) => void patchPlace(place.id, { tags })} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      </Field>
    </div>
  );
}

/**
 * A Place's address, edited where it stands (#487 story 15): a pick or a
 * Locate is saved at once with its coordinates; typed text is saved with
 * "Save address", which looks it up again (ADR 0011).
 */
function PlaceAddress({ place }: { place: Place }) {
  const [draft, setDraft] = useState(place.address);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(place.address), [place.address]);
  const dirty = draft.trim() !== place.address;

  async function save(input: AddressInput) {
    setBusy(true);
    try {
      const placed = await setPlaceAddress(place.id, input);
      setDraft(input.text.trim());
      if (placed === "none") toast.warning("Address saved, off the map: it was found nowhere.");
      if (placed === "failed") toast.warning("Address saved, off the map: the lookup failed. Locate it later.");
    } catch (e) {
      toast.error(`Couldn’t save the address: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-2">
      <PlaceSearchField label="Address" value={draft} onChange={setDraft} onPick={(hit) => void save({ text: hit.address, at: hit.at })} placeholder="Search or type an address…" />
      <div className="flex min-w-0 flex-wrap items-start gap-2">
        {dirty && (
          <Button type="button" size="sm" disabled={busy} onClick={() => void save({ text: draft })}>
            Save address
          </Button>
        )}
        {!dirty && place.address && !place.geo && <LocateButton address={place.address} onFound={(at) => void save({ text: place.address, at })} />}
        {!dirty && <WhereNote address={place.address} at={placeCoordsOf(place)} />}
      </div>
    </div>
  );
}

/** A Place's editable Peek (ADR 0085): the Atlas App's Fields; Core frames it with the name, the body and the way through to its page. */
export function PlacePeek({ doc }: PeekProps) {
  return <PlaceFields place={normalizePlace(doc)} />;
}
