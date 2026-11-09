import { Button, toast } from "@lifeline/ui";
import { Check, X } from "lucide-react";
import { draftChangeLines, REWRITABLE_FIELDS } from "../domain/draft";
import { acceptDraftChange, discardDraftChange, useItems } from "../data/repo";
import type { Item } from "../domain/types";

/**
 * An agent's draft change beside the item's own values (ADR 0115): what would change, the
 * current text struck above the drafted, to accept (applied as an ordinary edit, so Prompts keep
 * their Recalls by ADR 0058) or discard. Reads the item live, so it follows an accept or a newer draft change.
 */
export function DraftChangeNotice({ item, onDone }: { item: Item; onDone?: () => void }) {
  const live = useItems(item.languageId).find((i) => i.id === item.id) ?? item;
  const changes = draftChangeLines(live);
  if (!changes.length) return null;

  async function accept() {
    try {
      await acceptDraftChange(live);
      toast.success("Change accepted");
      onDone?.();
    } catch (e) {
      toast.error(`Could not accept the change: ${(e as Error).message}`);
    }
  }

  return (
    <section aria-label="Draft change" className="bg-accent/40 grid gap-2 rounded-lg border p-3 text-sm">
      <span className="text-xs font-medium">Draft change</span>
      <dl className="grid gap-2">
        {changes.map((c) => (
          <div key={c.key} className="grid min-w-0 gap-0.5">
            <dt className="text-muted-foreground text-xs">{REWRITABLE_FIELDS[c.key].label}</dt>
            <dd data-testid={`current-${c.key}`} className="text-muted-foreground min-w-0 break-words line-through">
              {c.current || "(empty)"}
            </dd>
            <dd data-testid={`drafted-${c.key}`} className="min-w-0 break-words font-medium">
              {c.drafted || "(empty)"}
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
            void discardDraftChange(live.id);
            onDone?.();
          }}>
          <X /> Discard
        </Button>
      </div>
    </section>
  );
}
