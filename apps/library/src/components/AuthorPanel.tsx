import { useState } from "react";
import { Link } from "react-router";
import { hasRole, type Document, type LinkIndex } from "@lifeline/core";
import { canTurnIntoPerson, TurnIntoPersonDialog } from "@lifeline/parts";
import { Button } from "@lifeline/ui";
import { BookOpen, UserRound } from "lucide-react";
import { AUTHOR } from "../domain/types";
import { authorHref } from "../constants";

/** On an Author's Vault page (ADR 0052): the way into the Library's Author screen, with a count of the Works that name them. */
export function AuthorPanel({ doc, index }: { doc: Document; index: LinkIndex }) {
  const [asking, setAsking] = useState(false);
  if (!hasRole(doc, AUTHOR)) return null;
  const works = index.backlinksTo(doc.id).filter((b) => b.field === "authors").length;
  return (
    <section className="text-sm">
      <Link to={authorHref(doc.id)} className="inline-flex items-center gap-1 underline-offset-2 hover:underline">
        <BookOpen className="size-3.5" /> Open in Library
      </Link>
      <span className="text-muted-foreground"> · {works} {works === 1 ? "work" : "works"}, bibliography</span>
      {canTurnIntoPerson(doc, AUTHOR) && (
        <div className="mt-2">
          <Button size="sm" variant="outline" onClick={() => setAsking(true)}>
            <UserRound /> Turn into a Person…
          </Button>
          <TurnIntoPersonDialog doc={asking ? doc : null} roleId={AUTHOR} onClose={() => setAsking(false)} />
        </div>
      )}
    </section>
  );
}
