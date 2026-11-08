import { Button, toast } from "@lifeline/ui";
import { Check, X } from "lucide-react";
import { proposedChanges } from "../domain/draft";
import { acceptProposal, discardProposal, useItems } from "../data/repo";
import type { Item, Proposal } from "../domain/types";

const LABEL: Record<keyof Proposal, string> = { term: "Word", meaning: "Meaning", text: "Sentence", translation: "Translation", question: "Question", answer: "Answer", notes: "Notes" };

/**
 * An agent's proposed rewrite beside the item's own values (ADR 0115): what would change, the
 * current text struck above the proposed, to accept (applied as an ordinary edit, so Prompts keep
 * their Recalls by ADR 0058) or discard. Reads the item live, so it follows an accept or a newer proposal.
 */
export function ProposalNotice({ item, onDone }: { item: Item; onDone?: () => void }) {
  const live = useItems(item.languageId).find((i) => i.id === item.id) ?? item;
  const changes = proposedChanges(live);
  if (!changes.length) return null;

  async function accept() {
    try {
      await acceptProposal(live);
      toast.success("Change accepted");
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section aria-label="Proposed change" className="bg-accent/40 grid gap-2 rounded-md border p-3 text-sm">
      <span className="text-xs font-medium">Proposed change</span>
      <dl className="grid gap-2">
        {changes.map((c) => (
          <div key={c.key} className="grid min-w-0 gap-0.5">
            <dt className="text-muted-foreground text-xs">{LABEL[c.key]}</dt>
            <dd data-testid={`current-${c.key}`} className="text-muted-foreground min-w-0 break-words line-through">
              {c.current || "(empty)"}
            </dd>
            <dd data-testid={`proposed-${c.key}`} className="min-w-0 break-words font-medium">
              {c.proposed || "(empty)"}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void accept()}>
          <Check /> Accept change
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void discardProposal(live.id);
            onDone?.();
          }}>
          <X /> Discard
        </Button>
      </div>
    </section>
  );
}
