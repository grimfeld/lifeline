import { useState } from "react";
import { canTurnIntoPerson, TurnIntoPersonDialog } from "@lifeline/parts";
import type { Document, LinkIndex } from "@lifeline/core";
import { Button } from "@lifeline/ui";
import { UserRound } from "lucide-react";
import { ARTIST } from "../domain/types";

/** On an Artist's Vault page: turn them into a Person once I come to know them (ADR 0113). */
export function ArtistPanel({ doc }: { doc: Document; index: LinkIndex }) {
  const [asking, setAsking] = useState(false);
  if (!canTurnIntoPerson(doc, ARTIST)) return null;
  return (
    <section className="text-sm">
      <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
        <UserRound /> Turn into a Person…
      </Button>
      <TurnIntoPersonDialog doc={asking ? doc : null} roleId={ARTIST} onClose={() => setAsking(false)} />
    </section>
  );
}
