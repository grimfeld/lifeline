import { canTurnIntoPerson, TurnIntoPersonButton } from "@lifeline/parts";
import type { Document, LinkIndex } from "@lifeline/core";
import { ARTIST } from "../domain/types";

/** On an Artist's Vault page: turn them into a Person once I come to know them (ADR 0113). */
export function ArtistPanel({ doc }: { doc: Document; index: LinkIndex }) {
  if (!canTurnIntoPerson(doc, ARTIST)) return null;
  return (
    <section className="text-sm">
      <TurnIntoPersonButton doc={doc} roleId={ARTIST} />
    </section>
  );
}
